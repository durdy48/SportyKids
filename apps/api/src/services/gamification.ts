import { prisma } from '../config/database';
import { safeJsonParse } from '../utils/safe-json-parse';
import { checkMissionProgress } from './mission-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  streakBroken: boolean;
  dailyStickerAwarded: { id: string; name: string; rarity: string } | null;
  pointsAwarded: number;
  newAchievements: Array<{ key: string; nameKey: string; icon: string }>;
}

interface AwardedSticker {
  id: string;
  name: string;
  nameKey: string;
  imageUrl: string;
  sport: string;
  rarity: string;
}

interface UnlockedAchievement {
  key: string;
  nameKey: string;
  icon: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get start of UTC day for a given date */
function startOfUTCDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Check if two dates are the same UTC day */
function isSameUTCDay(a: Date, b: Date): boolean {
  return startOfUTCDay(a).getTime() === startOfUTCDay(b).getTime();
}

/** Check if date a is exactly one day before date b (UTC) */
function isYesterdayUTC(a: Date, b: Date): boolean {
  const dayA = startOfUTCDay(a);
  const dayB = startOfUTCDay(b);
  const diff = dayB.getTime() - dayA.getTime();
  return diff === 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Streak milestones: { days: threshold, points: bonus, stickerRarity?: string }
// ---------------------------------------------------------------------------

const STREAK_MILESTONES = [
  { days: 3, points: 25, stickerRarity: undefined },
  { days: 7, points: 100, stickerRarity: 'epic' },
  { days: 14, points: 200, stickerRarity: undefined },
  { days: 30, points: 500, stickerRarity: 'legendary' },
];

// ---------------------------------------------------------------------------
// Points per activity type
// ---------------------------------------------------------------------------

const ACTIVITY_POINTS: Record<string, number> = {
  news_viewed: 5,
  reels_viewed: 3,
};

// ---------------------------------------------------------------------------
// checkAndUpdateStreak
// ---------------------------------------------------------------------------

export async function checkAndUpdateStreak(userId: string): Promise<StreakResult> {
  const now = new Date();
  let pointsAwarded = 0;
  let streakBroken = false;
  let dailyStickerAwarded: StreakResult['dailyStickerAwarded'] = null;
  let newAchievements: UnlockedAchievement[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastActiveDate: true,
        totalPoints: true,
      },
    });

    let { currentStreak, longestStreak } = user;
    const { lastActiveDate } = user;

    // Determine streak status
    if (lastActiveDate && isSameUTCDay(lastActiveDate, now)) {
      // Already checked in today — no-op for streak
      return { currentStreak, longestStreak, noOp: true };
    }

    if (lastActiveDate && isYesterdayUTC(lastActiveDate, now)) {
      // Consecutive day — increment streak
      currentStreak += 1;
    } else {
      // Streak broken (or first ever check-in)
      if (lastActiveDate) streakBroken = true;
      currentStreak = 1;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    // Award daily login points (+2)
    pointsAwarded += 2;

    // Check streak milestones
    for (const milestone of STREAK_MILESTONES) {
      if (currentStreak === milestone.days) {
        pointsAwarded += milestone.points;
      }
    }

    // Update user
    await tx.user.update({
      where: { id: userId },
      data: {
        currentStreak,
        longestStreak,
        lastActiveDate: now,
        totalPoints: { increment: pointsAwarded },
      },
    });

    return { currentStreak, longestStreak, noOp: false };
  });

  // If same-day no-op, return current state
  if ('noOp' in result && result.noOp) {
    return {
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      streakBroken: false,
      dailyStickerAwarded: null,
      pointsAwarded: 0,
      newAchievements: [],
    };
  }

  // Award daily login sticker (common rarity)
  const sticker = await awardSticker(userId, 'daily_login', 'common');
  if (sticker) {
    dailyStickerAwarded = { id: sticker.id, name: sticker.name, rarity: sticker.rarity };
  }

  // Award streak milestone stickers
  for (const milestone of STREAK_MILESTONES) {
    if (result.currentStreak === milestone.days && milestone.stickerRarity) {
      await awardSticker(userId, 'streak_milestone', milestone.stickerRarity);
    }
  }

  // Evaluate achievements
  newAchievements = await evaluateAchievements(userId);

  // Check daily mission progress for check-in
  await checkMissionProgress(userId, 'check_in');

  return {
    currentStreak: result.currentStreak,
    longestStreak: result.longestStreak,
    streakBroken,
    dailyStickerAwarded,
    pointsAwarded,
    newAchievements,
  };
}

// ---------------------------------------------------------------------------
// awardSticker
// ---------------------------------------------------------------------------

export async function awardSticker(
  userId: string,
  source: string,
  rarity?: string,
): Promise<AwardedSticker | null> {
  // Find available stickers not already owned using NOT IN subquery
  const ownedIds = (await prisma.userSticker.findMany({
    where: { userId },
    select: { stickerId: true },
  })).map((us) => us.stickerId);

  const where: Record<string, unknown> = {};
  if (rarity) where.rarity = rarity;
  if (ownedIds.length > 0) {
    where.id = { notIn: ownedIds };
  }

  const available = await prisma.sticker.findMany({ where, take: 50 });

  if (available.length === 0) return null;

  // Pick random sticker
  const picked = available[Math.floor(Math.random() * available.length)];

  // Create UserSticker (upsert to avoid race conditions)
  try {
    await prisma.userSticker.create({
      data: {
        userId,
        stickerId: picked.id,
        source,
      },
    });
  } catch {
    // Unique constraint violation — user already has this sticker
    return null;
  }

  const awarded: AwardedSticker = {
    id: picked.id,
    name: picked.name,
    nameKey: picked.nameKey,
    imageUrl: picked.imageUrl,
    sport: picked.sport,
    rarity: picked.rarity,
  };

  // Send push notification (non-blocking, uses user locale)
  Promise.all([import('./push-sender'), import('@sportykids/shared'), import('../config/database')])
    .then(async ([{ sendPushToUser }, { t }, { prisma: db }]) => {
      const u = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
      const locale = (u?.locale === 'en' ? 'en' : 'es') as 'es' | 'en';
      await sendPushToUser(userId, {
        title: t('push.sticker_earned_title', locale),
        body: t('push.sticker_earned_body', locale)
          .replace('{rarity}', picked.rarity)
          .replace('{name}', picked.name),
        data: { screen: 'Collection' },
      });
    })
    .catch(() => {}); // Non-blocking

  return awarded;
}

// ---------------------------------------------------------------------------
// Achievement definition cache (60s TTL to reduce DB overhead)
// ---------------------------------------------------------------------------

let achievementCache: { data: Array<Record<string, unknown>>; fetchedAt: number } | null = null;
const ACHIEVEMENT_CACHE_TTL = 60_000;

async function getCachedAchievements() {
  if (achievementCache && Date.now() - achievementCache.fetchedAt < ACHIEVEMENT_CACHE_TTL) {
    return achievementCache.data;
  }
  const data = await prisma.achievement.findMany();
  achievementCache = { data, fetchedAt: Date.now() };
  return data;
}

// ---------------------------------------------------------------------------
// evaluateAchievements
// ---------------------------------------------------------------------------

export async function evaluateAchievements(userId: string): Promise<UnlockedAchievement[]> {
  // Get user stats
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      totalPoints: true,
      currentStreak: true,
      longestStreak: true,
      quizPerfectCount: true,
      favoriteSports: true,
    },
  });

  // Count activity logs by type
  const activityCounts = await prisma.activityLog.groupBy({
    by: ['type'],
    where: { userId },
    _count: true,
  });
  const activityMap: Record<string, number> = {};
  for (const ac of activityCounts) {
    activityMap[ac.type] = ac._count;
  }

  // Count user stickers
  const stickerCount = await prisma.userSticker.count({ where: { userId } });

  // Count distinct sports from activity (we approximate via news items viewed)
  const favoriteSports: string[] = safeJsonParse(user.favoriteSports, []);
  const distinctSportsCount = favoriteSports.length;

  // Get all achievements (cached) and user's already-unlocked ones
  const allAchievements = await getCachedAchievements();
  const unlockedAchievements = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const unlockedIds = new Set(unlockedAchievements.map((ua) => ua.achievementId));

  const newlyUnlocked: UnlockedAchievement[] = [];

  for (const achievement of allAchievements) {
    if (unlockedIds.has(achievement.id)) continue;

    const met = checkThreshold(achievement, {
      newsViewed: activityMap['news_viewed'] ?? 0,
      reelsViewed: activityMap['reels_viewed'] ?? 0,
      quizzesPlayed: activityMap['quizzes_played'] ?? 0,
      quizPerfectCount: user.quizPerfectCount,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      totalPoints: user.totalPoints,
      stickerCount,
      distinctSportsCount,
    });

    if (met) {
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });

      // Award reward sticker if defined
      if (achievement.rewardStickerId) {
        try {
          await prisma.userSticker.create({
            data: {
              userId,
              stickerId: achievement.rewardStickerId,
              source: 'achievement',
            },
          });
        } catch {
          // Already owned — skip
        }
      }

      newlyUnlocked.push({
        key: achievement.key,
        nameKey: achievement.nameKey,
        icon: achievement.icon,
      });
    }
  }

  return newlyUnlocked;
}

// ---------------------------------------------------------------------------
// checkThreshold — maps achievement type+threshold to user stats
// ---------------------------------------------------------------------------

interface UserStats {
  newsViewed: number;
  reelsViewed: number;
  quizzesPlayed: number;
  quizPerfectCount: number;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  stickerCount: number;
  distinctSportsCount: number;
}

function checkThreshold(
  achievement: { type: string; threshold: number; key: string },
  stats: UserStats,
): boolean {
  switch (achievement.type) {
    case 'news_read':
      return stats.newsViewed >= achievement.threshold;
    case 'reels_watched':
      return stats.reelsViewed >= achievement.threshold;
    case 'quizzes_played':
      return stats.quizzesPlayed >= achievement.threshold;
    case 'quiz_perfect':
      return stats.quizPerfectCount >= achievement.threshold;
    case 'streak':
      return stats.longestStreak >= achievement.threshold;
    case 'all_sports':
      return stats.distinctSportsCount >= achievement.threshold;
    case 'stickers_collected':
      return stats.stickerCount >= achievement.threshold;
    case 'points':
      return stats.totalPoints >= achievement.threshold;
    case 'daily_login':
      return stats.longestStreak >= achievement.threshold;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// awardPointsForActivity
// ---------------------------------------------------------------------------

export async function awardPointsForActivity(
  userId: string,
  type: string,
): Promise<{ pointsAwarded: number; newAchievements: UnlockedAchievement[] }> {
  const points = ACTIVITY_POINTS[type] ?? 0;

  if (points > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { increment: points } },
    });
  }

  const newAchievements = await evaluateAchievements(userId);

  return { pointsAwarded: points, newAchievements };
}
