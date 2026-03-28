import { prisma } from '../config/database';
import { t } from '@sportykids/shared';
import { awardSticker } from './gamification';


// ---------------------------------------------------------------------------
// Mission type definitions
// ---------------------------------------------------------------------------

interface MissionType {
  type: string;
  titleKey: string;
  descKey: string;
  minTarget: number;
  maxTarget: number;
  rewardType: string;
  rewardRarity: string;
  rewardPoints: number;
  weight: number;
}

const MISSION_TYPES: MissionType[] = [
  { type: 'read_news', titleKey: 'mission.read_news', descKey: 'mission.read_news_desc', minTarget: 2, maxTarget: 5, rewardType: 'sticker', rewardRarity: 'rare', rewardPoints: 0, weight: 3 },
  { type: 'watch_reels', titleKey: 'mission.watch_reels', descKey: 'mission.watch_reels_desc', minTarget: 2, maxTarget: 4, rewardType: 'sticker', rewardRarity: 'rare', rewardPoints: 0, weight: 2 },
  { type: 'quiz_master', titleKey: 'mission.quiz_master', descKey: 'mission.quiz_master_desc', minTarget: 3, maxTarget: 5, rewardType: 'sticker', rewardRarity: 'epic', rewardPoints: 0, weight: 2 },
  { type: 'quiz_perfect', titleKey: 'mission.quiz_perfect', descKey: 'mission.quiz_perfect_desc', minTarget: 1, maxTarget: 1, rewardType: 'sticker', rewardRarity: 'epic', rewardPoints: 0, weight: 1 },
  { type: 'read_and_quiz', titleKey: 'mission.read_and_quiz', descKey: 'mission.read_and_quiz_desc', minTarget: 3, maxTarget: 3, rewardType: 'both', rewardRarity: 'rare', rewardPoints: 50, weight: 1 },
  { type: 'multi_sport', titleKey: 'mission.multi_sport', descKey: 'mission.multi_sport_desc', minTarget: 2, maxTarget: 3, rewardType: 'sticker', rewardRarity: 'rare', rewardPoints: 0, weight: 1 },
  { type: 'streak_keeper', titleKey: 'mission.streak_keeper', descKey: 'mission.streak_keeper_desc', minTarget: 1, maxTarget: 1, rewardType: 'points', rewardRarity: '', rewardPoints: 25, weight: 2 },
  { type: 'first_report', titleKey: 'mission.first_report', descKey: 'mission.first_report_desc', minTarget: 1, maxTarget: 1, rewardType: 'sticker', rewardRarity: 'common', rewardPoints: 0, weight: 1 },
];

// Exported for testing
export { MISSION_TYPES };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/** Weighted random selection from an array of items with a weight property */
function weightedRandomPick(items: MissionType[]): MissionType {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// generateDailyMission
// ---------------------------------------------------------------------------

export async function generateDailyMission(
  userId: string,
  locale: 'es' | 'en' = 'es',
): Promise<Record<string, unknown>> {
  const today = getTodayDate();

  // Check if mission already exists for today
  const existing = await prisma.dailyMission.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existing) return existing;

  // Fetch user info and parental profile
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { age: true, favoriteSports: true },
  });

  const parentalProfile = await prisma.parentalProfile.findUnique({
    where: { userId },
    select: { allowedFormats: true },
  });

  const allowedFormats: string[] = parentalProfile
    ? parentalProfile.allowedFormats
    : ['news', 'reels', 'quiz'];

  // Filter mission types based on parental restrictions
  const availableMissions = MISSION_TYPES.filter((m) => {
    if (m.type === 'watch_reels' && !allowedFormats.includes('reels')) return false;
    if ((m.type === 'quiz_master' || m.type === 'quiz_perfect') && !allowedFormats.includes('quiz')) return false;
    if (m.type === 'read_and_quiz' && (!allowedFormats.includes('news') || !allowedFormats.includes('quiz'))) return false;
    return true;
  });

  // Pick a mission via weighted random selection
  const picked = weightedRandomPick(availableMissions);

  // Determine target based on age (younger kids get lower targets)
  const target = user.age <= 8
    ? picked.minTarget
    : picked.minTarget + Math.floor(Math.random() * (picked.maxTarget - picked.minTarget + 1));

  // Render localized title and description
  const title = t(picked.titleKey, locale, { target: String(target) });
  const description = t(picked.descKey, locale, { target: String(target) });

  // Create the mission record
  const mission = await prisma.dailyMission.create({
    data: {
      userId,
      date: today,
      type: picked.type,
      title,
      description,
      target,
      progress: 0,
      completed: false,
      rewardType: picked.rewardType,
      rewardRarity: picked.rewardRarity || null,
      rewardPoints: picked.rewardPoints,
      claimed: false,
    },
  });

  return mission;
}

// ---------------------------------------------------------------------------
// checkMissionProgress
// ---------------------------------------------------------------------------

export async function checkMissionProgress(
  userId: string,
  activityType: string,
  _sport?: string,
): Promise<{ missionUpdated: boolean; completed: boolean; mission: Record<string, unknown> | null }> {
  const today = getTodayDate();

  // Find today's active (not completed) mission
  const mission = await prisma.dailyMission.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (!mission || mission.completed) {
    return { missionUpdated: false, completed: false, mission: mission ?? null };
  }

  let newProgress = mission.progress;
  let nowCompleted = false;

  switch (mission.type) {
    case 'read_news': {
      if (activityType === 'news_viewed') {
        newProgress = mission.progress + 1;
      }
      break;
    }
    case 'watch_reels': {
      if (activityType === 'reels_viewed') {
        newProgress = mission.progress + 1;
      }
      break;
    }
    case 'quiz_master': {
      if (activityType === 'quiz_correct' || activityType === 'quizzes_played') {
        newProgress = mission.progress + 1;
      }
      break;
    }
    case 'quiz_perfect': {
      if (activityType === 'quiz_perfect') {
        newProgress = mission.target; // Instantly complete
      }
      break;
    }
    case 'read_and_quiz': {
      // Compound mission: count news reads and check if quiz was played today
      if (activityType === 'news_viewed') {
        // Count today's news views for progress display
        const startOfDay = new Date(`${today}T00:00:00.000Z`);
        const endOfDay = new Date(`${today}T23:59:59.999Z`);

        const newsCount = await prisma.activityLog.count({
          where: {
            userId,
            type: 'news_viewed',
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
        });

        const quizPlayed = await prisma.activityLog.count({
          where: {
            userId,
            type: 'quizzes_played',
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
        });

        // Progress = min(newsCount, target - 1) + (quizPlayed > 0 ? 1 : 0)
        // News counts for (target - 1) slots, quiz for the last 1
        const newsProgress = Math.min(newsCount, mission.target - 1);
        newProgress = newsProgress + (quizPlayed > 0 ? 1 : 0);
      } else if (activityType === 'quizzes_played') {
        const startOfDay = new Date(`${today}T00:00:00.000Z`);
        const endOfDay = new Date(`${today}T23:59:59.999Z`);

        const newsCount = await prisma.activityLog.count({
          where: {
            userId,
            type: 'news_viewed',
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
        });

        const newsProgress = Math.min(newsCount, mission.target - 1);
        newProgress = newsProgress + 1; // quiz just played
      }
      break;
    }
    case 'multi_sport': {
      if (activityType === 'news_viewed') {
        // Count distinct sports from today's news_viewed activity
        const startOfDay = new Date(`${today}T00:00:00.000Z`);
        const endOfDay = new Date(`${today}T23:59:59.999Z`);

        const sportsToday = await prisma.activityLog.findMany({
          where: {
            userId,
            type: 'news_viewed',
            createdAt: { gte: startOfDay, lte: endOfDay },
            sport: { not: null },
          },
          select: { sport: true },
          distinct: ['sport'],
        });

        newProgress = sportsToday.length;
      }
      break;
    }
    case 'streak_keeper': {
      if (activityType === 'check_in') {
        newProgress = mission.target; // Instantly complete
      }
      break;
    }
    case 'first_report': {
      if (activityType === 'report_submitted') {
        newProgress = mission.target; // Instantly complete
      }
      break;
    }
    default:
      return { missionUpdated: false, completed: false, mission };
  }

  // No change in progress
  if (newProgress === mission.progress) {
    return { missionUpdated: false, completed: false, mission };
  }

  // Check if mission is now completed
  nowCompleted = newProgress >= mission.target;

  const updated = await prisma.dailyMission.update({
    where: { id: mission.id },
    data: {
      progress: newProgress,
      completed: nowCompleted,
      ...(nowCompleted && { completedAt: new Date() }),
    },
  });

  return { missionUpdated: true, completed: nowCompleted, mission: updated };
}

// ---------------------------------------------------------------------------
// claimMissionReward
// ---------------------------------------------------------------------------

export async function claimMissionReward(
  userId: string,
): Promise<{ claimed: boolean; sticker: Record<string, unknown> | null; pointsAwarded: number }> {
  const today = getTodayDate();

  // Find today's completed but unclaimed mission
  const mission = await prisma.dailyMission.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (!mission || !mission.completed || mission.claimed) {
    return { claimed: false, sticker: null, pointsAwarded: 0 };
  }

  let sticker: Record<string, unknown> | null = null;
  let pointsAwarded = 0;

  // Award sticker if reward includes sticker
  if (mission.rewardType === 'sticker' || mission.rewardType === 'both') {
    const awarded = await awardSticker(userId, 'mission', mission.rewardRarity || undefined);
    if (awarded) {
      sticker = awarded;
    }
  }

  // Award points if reward includes points
  if (mission.rewardType === 'points' || mission.rewardType === 'both') {
    pointsAwarded = mission.rewardPoints;
    if (pointsAwarded > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: pointsAwarded } },
      });
    }
  }

  // Mark as claimed
  await prisma.dailyMission.update({
    where: { id: mission.id },
    data: { claimed: true, claimedAt: new Date() },
  });

  return { claimed: true, sticker, pointsAwarded };
}
