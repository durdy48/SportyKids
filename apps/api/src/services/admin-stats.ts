import { SPORTS } from '@sportykids/shared';
import { prisma } from '../config/database.js';

// ---------------------------------------------------------------------------
// Helper: build start/end of a UTC day
// ---------------------------------------------------------------------------
function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ---------------------------------------------------------------------------
// DAU — distinct active users on a given date
// ---------------------------------------------------------------------------
export async function computeDau(date: Date): Promise<{ count: number }> {
  const { start, end } = dayBounds(date);
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT "userId") AS count
    FROM "ActivityLog"
    WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
  `;
  return { count: Number(result[0]?.count ?? 0) };
}

// ---------------------------------------------------------------------------
// MAU — distinct active users in the 30 days ending on date (inclusive)
// ---------------------------------------------------------------------------
export async function computeMau(date: Date): Promise<{ count: number }> {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT "userId") AS count
    FROM "ActivityLog"
    WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
  `;
  return { count: Number(result[0]?.count ?? 0) };
}

// ---------------------------------------------------------------------------
// Sport Activity — grouped by sport field for target date
// ---------------------------------------------------------------------------
export async function computeSportActivity(date: Date): Promise<Record<string, number>> {
  const { start, end } = dayBounds(date);

  const groups = await prisma.activityLog.groupBy({
    by: ['sport'],
    where: { createdAt: { gte: start, lte: end }, sport: { not: null } },
    _count: { sport: true },
  });

  // Initialise with 0 for every sport
  const result: Record<string, number> = {};
  for (const sport of SPORTS) {
    result[sport] = 0;
  }

  for (const group of groups) {
    if (group.sport && result[group.sport] !== undefined) {
      result[group.sport] = group._count.sport;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Retention D1 — users registered yesterday who were active today
// ---------------------------------------------------------------------------
export async function computeRetentionD1(date: Date): Promise<{ rate: number; cohortSize: number }> {
  const dayBefore = new Date(date);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(0, 0, 0, 0);
  const dayBeforeEnd = new Date(dayBefore);
  dayBeforeEnd.setHours(23, 59, 59, 999);

  const cohort = await prisma.user.findMany({
    where: { createdAt: { gte: dayBefore, lte: dayBeforeEnd } },
    select: { id: true },
  });

  if (cohort.length === 0) return { rate: 0, cohortSize: 0 };

  const cohortIds = cohort.map((u) => u.id);
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  const retained = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT "userId") AS count
    FROM "ActivityLog"
    WHERE "userId" = ANY(${cohortIds}::text[])
      AND "createdAt" >= ${dateStart}
      AND "createdAt" <= ${dateEnd}
  `;
  const retainedCount = Number(retained[0]?.count ?? 0);

  return {
    rate: Math.round((retainedCount / cohort.length) * 100) / 100,
    cohortSize: cohort.length,
  };
}

// ---------------------------------------------------------------------------
// Retention D7 — users registered 7 days before who were active in last 7 days
// ---------------------------------------------------------------------------
export async function computeRetentionD7(date: Date): Promise<{ rate: number; cohortSize: number }> {
  const sevenDaysBefore = new Date(date);
  sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
  sevenDaysBefore.setHours(0, 0, 0, 0);
  const sevenDaysBeforeEnd = new Date(sevenDaysBefore);
  sevenDaysBeforeEnd.setHours(23, 59, 59, 999);

  const cohort = await prisma.user.findMany({
    where: { createdAt: { gte: sevenDaysBefore, lte: sevenDaysBeforeEnd } },
    select: { id: true },
  });

  if (cohort.length === 0) return { rate: 0, cohortSize: 0 };

  const cohortIds = cohort.map((u) => u.id);

  // Active in the last 7 days (date-6 to date)
  const windowStart = new Date(date);
  windowStart.setDate(windowStart.getDate() - 6);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(date);
  windowEnd.setHours(23, 59, 59, 999);

  const retained = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT "userId") AS count
    FROM "ActivityLog"
    WHERE "userId" = ANY(${cohortIds}::text[])
      AND "createdAt" >= ${windowStart}
      AND "createdAt" <= ${windowEnd}
  `;
  const retainedCount = Number(retained[0]?.count ?? 0);

  return {
    rate: Math.round((retainedCount / cohort.length) * 100) / 100,
    cohortSize: cohort.length,
  };
}

// ---------------------------------------------------------------------------
// Subscription Breakdown
// ---------------------------------------------------------------------------
export async function computeSubscriptionBreakdown(): Promise<{ free: number; premium: number }> {
  const groups = await prisma.user.groupBy({ by: ['subscriptionTier'], _count: { _all: true } });
  const free = groups.find((g) => g.subscriptionTier === 'free')?._count._all ?? 0;
  const premium = groups.find((g) => g.subscriptionTier === 'premium')?._count._all ?? 0;
  return { free, premium };
}

// ---------------------------------------------------------------------------
// Parental Activation Rate
// ---------------------------------------------------------------------------
export async function computeParentalActivationRate(): Promise<{
  rate: number;
  withParental: number;
  totalParents: number;
}> {
  const [totalParents, withParental] = await Promise.all([
    prisma.user.count({ where: { role: 'parent' } }),
    prisma.parentalProfile.count(),
  ]);
  return {
    rate: totalParents === 0 ? 0 : Math.round((withParental / totalParents) * 100) / 100,
    withParental,
    totalParents,
  };
}

// ---------------------------------------------------------------------------
// Consent Rate
// ---------------------------------------------------------------------------
export async function computeConsentRate(): Promise<{ rate: number; consented: number; total: number }> {
  const [total, consented] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { consentGiven: true } }),
  ]);
  return {
    rate: total === 0 ? 0 : Math.round((consented / total) * 100) / 100,
    consented,
    total,
  };
}

// ---------------------------------------------------------------------------
// Quiz Engagement
// ---------------------------------------------------------------------------
export async function computeQuizEngagement(
  date: Date,
): Promise<{ rate: number; quizAnswered: number; dau: number }> {
  const { start, end } = dayBounds(date);
  const [dauResult, quizAnswered] = await Promise.all([
    computeDau(date),
    prisma.activityLog.count({
      where: { type: 'quizzes_played', createdAt: { gte: start, lte: end } },
    }),
  ]);
  const dau = dauResult.count;
  return {
    rate: dau === 0 ? 0 : Math.round((quizAnswered / dau) * 100) / 100,
    quizAnswered,
    dau,
  };
}

// ---------------------------------------------------------------------------
// Missions Completed
// ---------------------------------------------------------------------------
export async function computeMissionsCompleted(date: Date): Promise<{ count: number }> {
  const dateStr = date.toISOString().split('T')[0]!;
  // `date` is a String field stored as 'YYYY-MM-DD', so startsWith filters by day without DateTime casting
  const count = await prisma.dailyMission.count({
    where: { completed: true, date: { startsWith: dateStr } },
  });
  return { count };
}

// ---------------------------------------------------------------------------
// Missions Claimed
// ---------------------------------------------------------------------------
export async function computeMissionsClaimed(date: Date): Promise<{ count: number }> {
  const dateStr = date.toISOString().split('T')[0]!;
  // `date` is a String field stored as 'YYYY-MM-DD', so startsWith filters by day without DateTime casting
  const count = await prisma.dailyMission.count({
    where: { claimed: true, date: { startsWith: dateStr } },
  });
  return { count };
}
