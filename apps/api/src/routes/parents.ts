import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { t } from '@sportykids/shared';
import { prisma } from '../config/database';
import type { Prisma } from '@prisma/client';
import { awardPointsForActivity } from '../services/gamification';
import { checkMissionProgress } from '../services/mission-generator';
import { invalidateProfileCache } from '../middleware/parental-guard';
import { invalidateBehavioralCache } from '../services/feed-ranker';
import { safeJsonParse } from '../utils/safe-json-parse';
import { generateDigestData, renderDigestHtml, renderDigestPdf } from '../services/digest-generator';

const router = Router();

// ---------------------------------------------------------------------------
// Session token store (in-memory, 5-min expiry)
// ---------------------------------------------------------------------------
const parentSessions = new Map<string, { userId: string; expiresAt: number }>();

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired sessions every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of parentSessions) {
    if (session.expiresAt <= now) {
      parentSessions.delete(token);
    }
  }
}, 5 * 60_000);

function createSession(userId: string): { sessionToken: string; expiresAt: number } {
  const sessionToken = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  parentSessions.set(sessionToken, { userId, expiresAt });
  return { sessionToken, expiresAt };
}

/**
 * Validate a parental session token from X-Parental-Session header.
 * Returns the userId if valid, null otherwise.
 */
export function verifyParentalSession(token: string | undefined): string | null {
  if (!token) return null;
  const session = parentSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    parentSessions.delete(token);
    return null;
  }
  return session.userId;
}

/** Check if a stored hash is a legacy SHA-256 hex string (64 hex chars) */
function isSha256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

function hashPinSha256(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

// ---------------------------------------------------------------------------
// POST /api/parents/setup — Create parental profile with PIN (bcrypt)
// ---------------------------------------------------------------------------
const configureSchema = z.object({
  userId: z.string(),
  pin: z.string().length(4).regex(/^\d{4}$/),
  allowedSports: z.array(z.string()).optional(),
  allowedFormats: z.array(z.enum(['news', 'reels', 'quiz'])).optional(),
  maxDailyTimeMinutes: z.number().int().min(0).max(480).optional(),
  maxNewsMinutes: z.number().int().min(0).max(480).optional().nullable(),
  maxReelsMinutes: z.number().int().min(0).max(480).optional().nullable(),
  maxQuizMinutes: z.number().int().min(0).max(480).optional().nullable(),
  allowedHoursStart: z.number().int().min(0).max(23).optional(),
  allowedHoursEnd: z.number().int().min(0).max(24).optional(),
  timezone: z.string().optional(),
});

router.post('/setup', async (req: Request, res: Response) => {
  const parsed = configureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    return;
  }

  const { userId, pin, allowedSports, allowedFormats, maxDailyTimeMinutes, maxNewsMinutes, maxReelsMinutes, maxQuizMinutes, allowedHoursStart, allowedHoursEnd, timezone } = parsed.data;

  const hashedPin = await bcrypt.hash(pin, 10);

  const profile = await prisma.parentalProfile.upsert({
    where: { userId },
    update: {
      pin: hashedPin,
      ...(allowedSports && { allowedSports: JSON.stringify(allowedSports) }),
      ...(allowedFormats && { allowedFormats: JSON.stringify(allowedFormats) }),
      ...(maxDailyTimeMinutes !== undefined && { maxDailyTimeMinutes }),
      ...(maxNewsMinutes !== undefined && { maxNewsMinutes }),
      ...(maxReelsMinutes !== undefined && { maxReelsMinutes }),
      ...(maxQuizMinutes !== undefined && { maxQuizMinutes }),
      ...(allowedHoursStart !== undefined && { allowedHoursStart }),
      ...(allowedHoursEnd !== undefined && { allowedHoursEnd }),
      ...(timezone !== undefined && { timezone }),
    },
    create: {
      userId,
      pin: hashedPin,
      allowedSports: JSON.stringify(allowedSports ?? []),
      allowedFormats: JSON.stringify(allowedFormats ?? ['news', 'reels', 'quiz']),
      maxDailyTimeMinutes: maxDailyTimeMinutes ?? 60,
      maxNewsMinutes: maxNewsMinutes ?? null,
      maxReelsMinutes: maxReelsMinutes ?? null,
      maxQuizMinutes: maxQuizMinutes ?? null,
      allowedHoursStart: allowedHoursStart ?? 7,
      allowedHoursEnd: allowedHoursEnd ?? 21,
      timezone: timezone ?? 'Europe/Madrid',
    },
  });

  // Invalidate parental guard cache after profile change
  invalidateProfileCache(userId);

  res.json(formatProfile(profile));
});

// ---------------------------------------------------------------------------
// POST /api/parents/verify-pin — Verify PIN (bcrypt with SHA-256 migration + lockout)
// ---------------------------------------------------------------------------
const verifySchema = z.object({
  userId: z.string(),
  pin: z.string().length(4),
});

// Hardcoded by design — not env-configurable to prevent weakening brute-force protection
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

router.post('/verify-pin', async (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  const profile = await prisma.parentalProfile.findUnique({
    where: { userId: parsed.data.userId },
  });

  if (!profile) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // Fetch user locale for i18n error messages
  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { locale: true },
  });
  const locale = (user?.locale === 'en' ? 'en' : 'es') as 'es' | 'en';

  // Check lockout
  if (profile.lockedUntil && profile.lockedUntil.getTime() > Date.now()) {
    const remainingSeconds = Math.ceil((profile.lockedUntil.getTime() - Date.now()) / 1000);
    const minutes = Math.ceil(remainingSeconds / 60);
    res.status(423).json({
      error: t('parental.pin_locked', locale, { minutes: String(minutes) }),
      lockedUntil: profile.lockedUntil.toISOString(),
      remainingSeconds,
    });
    return;
  }

  let verified = false;

  // Try bcrypt first
  try {
    verified = await bcrypt.compare(parsed.data.pin, profile.pin);
  } catch {
    // Not a valid bcrypt hash — fall through to SHA-256 check
  }

  // Transparent migration: if bcrypt failed, try legacy SHA-256
  if (!verified && isSha256Hash(profile.pin)) {
    const sha256Match = profile.pin === hashPinSha256(parsed.data.pin);
    if (sha256Match) {
      verified = true;
      // Re-hash with bcrypt for future logins
      const bcryptHash = await bcrypt.hash(parsed.data.pin, 10);
      await prisma.parentalProfile.update({
        where: { userId: parsed.data.userId },
        data: { pin: bcryptHash },
      });
    }
  }

  if (verified) {
    // Reset failed attempts on success
    await prisma.parentalProfile.update({
      where: { userId: parsed.data.userId },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    const session = createSession(parsed.data.userId);
    res.json({
      verified: true,
      exists: true,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      profile: formatProfile(profile),
    });
  } else {
    const newFailedAttempts = profile.failedAttempts + 1;

    if (newFailedAttempts >= MAX_PIN_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + PIN_LOCKOUT_DURATION_MS);
      await prisma.parentalProfile.update({
        where: { userId: parsed.data.userId },
        data: { failedAttempts: newFailedAttempts, lockedUntil },
      });
      const remainingSeconds = Math.ceil(PIN_LOCKOUT_DURATION_MS / 1000);
      const minutes = Math.ceil(remainingSeconds / 60);
      res.status(423).json({
        error: t('parental.pin_locked', locale, { minutes: String(minutes) }),
        lockedUntil: lockedUntil.toISOString(),
        remainingSeconds,
      });
    } else {
      await prisma.parentalProfile.update({
        where: { userId: parsed.data.userId },
        data: { failedAttempts: newFailedAttempts },
      });
      const attemptsRemaining = MAX_PIN_ATTEMPTS - newFailedAttempts;
      res.status(401).json({
        error: t('parental.pin_incorrect', locale, { remaining: String(attemptsRemaining) }),
        attemptsRemaining,
      });
    }
  }
});

// ---------------------------------------------------------------------------
// GET /api/parents/profile/:userId — Get parental profile
// ---------------------------------------------------------------------------
router.get('/profile/:userId', async (req: Request, res: Response) => {
  const sessionUserId = verifyParentalSession(req.headers['x-parental-session'] as string | undefined);

  const profile = await prisma.parentalProfile.findUnique({
    where: { userId: req.params.userId },
  });

  if (!profile) {
    res.json({ exists: false });
    return;
  }

  // Without a valid session, only confirm existence (no sensitive data)
  if (!sessionUserId) {
    res.json({ exists: true });
    return;
  }

  res.json({ exists: true, profile: formatProfile(profile) });
});

// ---------------------------------------------------------------------------
// PUT /api/parents/profile/:userId — Update restrictions
// ---------------------------------------------------------------------------
const updateSchema = z.object({
  allowedSports: z.array(z.string()).optional(),
  allowedFormats: z.array(z.enum(['news', 'reels', 'quiz'])).optional(),
  maxDailyTimeMinutes: z.number().int().min(0).max(480).optional(),
  maxNewsMinutes: z.number().int().min(0).max(480).optional().nullable(),
  maxReelsMinutes: z.number().int().min(0).max(480).optional().nullable(),
  maxQuizMinutes: z.number().int().min(0).max(480).optional().nullable(),
  allowedHoursStart: z.number().int().min(0).max(23).optional(),
  allowedHoursEnd: z.number().int().min(0).max(24).optional(),
  timezone: z.string().optional(),
});

router.put('/profile/:userId', async (req: Request, res: Response) => {
  const sessionUserId = verifyParentalSession(req.headers['x-parental-session'] as string | undefined);
  if (!sessionUserId) {
    res.status(401).json({ error: 'Parental session required' });
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  const { allowedSports, allowedFormats, maxDailyTimeMinutes, maxNewsMinutes, maxReelsMinutes, maxQuizMinutes, allowedHoursStart, allowedHoursEnd, timezone } = parsed.data;

  // Validate schedule: start must be less than end
  if (allowedHoursStart !== undefined && allowedHoursEnd !== undefined && allowedHoursStart >= allowedHoursEnd) {
    res.status(400).json({ error: 'allowedHoursStart must be less than allowedHoursEnd' });
    return;
  }

  const data: Prisma.ParentalProfileUpdateInput = {};
  if (allowedSports) data.allowedSports = JSON.stringify(allowedSports);
  if (allowedFormats) data.allowedFormats = JSON.stringify(allowedFormats);
  if (maxDailyTimeMinutes !== undefined) data.maxDailyTimeMinutes = maxDailyTimeMinutes;
  if (maxNewsMinutes !== undefined) data.maxNewsMinutes = maxNewsMinutes;
  if (maxReelsMinutes !== undefined) data.maxReelsMinutes = maxReelsMinutes;
  if (maxQuizMinutes !== undefined) data.maxQuizMinutes = maxQuizMinutes;
  if (allowedHoursStart !== undefined) data.allowedHoursStart = allowedHoursStart;
  if (allowedHoursEnd !== undefined) data.allowedHoursEnd = allowedHoursEnd;
  if (timezone !== undefined) data.timezone = timezone;

  const profile = await prisma.parentalProfile.update({
    where: { userId: req.params.userId },
    data,
  });

  // Invalidate parental guard cache after profile change
  invalidateProfileCache(req.params.userId);

  res.json(formatProfile(profile));
});

// ---------------------------------------------------------------------------
// GET /api/parents/activity/:userId — Weekly summary
// ---------------------------------------------------------------------------
router.get('/activity/:userId', async (req: Request, res: Response) => {
  const sessionUserId = verifyParentalSession(req.headers['x-parental-session'] as string | undefined);
  if (!sessionUserId) {
    res.status(401).json({ error: 'Parental session required' });
    return;
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const records = await prisma.activityLog.groupBy({
    by: ['type'],
    where: {
      userId: req.params.userId,
      createdAt: { gte: oneWeekAgo },
    },
    _count: true,
  });

  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { totalPoints: true },
  });

  const summary: Record<string, number> = {
    news_viewed: 0,
    reels_viewed: 0,
    quizzes_played: 0,
  };

  for (const r of records) {
    summary[r.type] = r._count;
  }

  res.json({
    ...summary,
    totalPoints: user?.totalPoints ?? 0,
    period: 'last 7 days',
  });
});

// ---------------------------------------------------------------------------
// GET /api/parents/activity/:userId/detail — Detailed activity breakdown
// ---------------------------------------------------------------------------
const detailQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

router.get('/activity/:userId/detail', async (req: Request, res: Response) => {
  const sessionUserId = verifyParentalSession(req.headers['x-parental-session'] as string | undefined);
  if (!sessionUserId) {
    res.status(401).json({ error: 'Parental session required' });
    return;
  }

  const parsed = detailQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten() });
    return;
  }

  const userId = req.params.userId;
  const now = new Date();
  const from = parsed.data.from ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const to = parsed.data.to ?? now;

  const logs = await prisma.activityLog.findMany({
    where: {
      userId,
      createdAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Build daily breakdown
  const dailyMap = new Map<string, {
    date: string;
    totalSeconds: number;
    counts: Record<string, number>;
    sports: Record<string, number>;
  }>();

  // Track top content
  const contentCounts = new Map<string, { contentId: string; type: string; count: number }>();

  let totalSeconds = 0;
  let totalEvents = 0;
  const typeCounts: Record<string, number> = {};
  const sportCounts: Record<string, number> = {};

  for (const log of logs) {
    const dateKey = log.createdAt.toISOString().split('T')[0];
    totalEvents++;

    // Daily breakdown
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { date: dateKey, totalSeconds: 0, counts: {}, sports: {} });
    }
    const day = dailyMap.get(dateKey)!;
    day.totalSeconds += log.durationSeconds || 0;
    day.counts[log.type] = (day.counts[log.type] || 0) + 1;
    if (log.sport) {
      day.sports[log.sport] = (day.sports[log.sport] || 0) + 1;
    }

    // Totals
    totalSeconds += log.durationSeconds || 0;
    typeCounts[log.type] = (typeCounts[log.type] || 0) + 1;
    if (log.sport) {
      sportCounts[log.sport] = (sportCounts[log.sport] || 0) + 1;
    }

    // Top content tracking
    if (log.contentId) {
      const key = `${log.type}:${log.contentId}`;
      if (!contentCounts.has(key)) {
        contentCounts.set(key, { contentId: log.contentId, type: log.type, count: 0 });
      }
      contentCounts.get(key)!.count++;
    }
  }

  // Sort top content by count descending, take top 10
  const topContent = Array.from(contentCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  res.json({
    from: from.toISOString(),
    to: to.toISOString(),
    dailyBreakdown,
    topContent,
    totals: {
      events: totalEvents,
      totalMinutes: Math.round(totalSeconds / 60),
      byType: typeCounts,
      bySport: sportCounts,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/parents/activity/log — Log activity (with detail fields)
// ---------------------------------------------------------------------------
const logSchema = z.object({
  userId: z.string(),
  type: z.enum(['news_viewed', 'reels_viewed', 'quizzes_played']),
  durationSeconds: z.number().int().min(0).optional(),
  contentId: z.string().optional(),
  sport: z.string().optional(),
});

router.post('/activity/log', async (req: Request, res: Response) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  await prisma.activityLog.create({
    data: {
      userId: parsed.data.userId,
      type: parsed.data.type,
      durationSeconds: parsed.data.durationSeconds,
      contentId: parsed.data.contentId,
      sport: parsed.data.sport,
    },
  });

  // Invalidate behavioral cache so next feed request uses fresh signals
  invalidateBehavioralCache(parsed.data.userId);

  // Award points for activity (news_viewed, reels_viewed)
  const gamificationResult = await awardPointsForActivity(
    parsed.data.userId,
    parsed.data.type,
  );

  // Check daily mission progress
  const missionResult = await checkMissionProgress(
    parsed.data.userId,
    parsed.data.type,
    parsed.data.sport,
  );

  res.json({
    ok: true,
    pointsAwarded: gamificationResult.pointsAwarded,
    newAchievements: gamificationResult.newAchievements,
    mission: missionResult.missionUpdated ? missionResult : undefined,
  });
});

// ---------------------------------------------------------------------------
// GET /api/parents/preview/:userId — "See What My Kid Sees" parent preview
// ---------------------------------------------------------------------------
router.get('/preview/:userId', async (req: Request, res: Response) => {
  const sessionUserId = verifyParentalSession(req.headers['x-parental-session'] as string | undefined);
  if (!sessionUserId) {
    res.status(401).json({ error: 'Parental session required' });
    return;
  }

  const userId = req.params.userId;
  const profile = await prisma.parentalProfile.findUnique({ where: { userId } });
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!profile || !user) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const allowedFormats: string[] = safeJsonParse(profile.allowedFormats as string, []);
  const allowedSports: string[] = safeJsonParse(profile.allowedSports as string, []);
  const favoriteSports: string[] = safeJsonParse(user.favoriteSports as string, []);

  // Fetch news if format allowed
  let news: unknown[] = [];
  if (allowedFormats.includes('news')) {
    const sportFilter = allowedSports.length > 0
      ? { sport: { in: allowedSports } }
      : (favoriteSports.length > 0 ? { sport: { in: favoriteSports } } : {});
    news = await prisma.newsItem.findMany({
      where: { safetyStatus: 'approved', ...sportFilter },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    });
  }

  // Fetch reels if format allowed
  let reels: unknown[] = [];
  if (allowedFormats.includes('reels')) {
    reels = await prisma.reel.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
  }

  const quizAvailable = allowedFormats.includes('quiz');

  res.json({ news, reels, quizAvailable });
});

// ---------------------------------------------------------------------------
// PUT /api/parents/digest/:userId — Update digest preferences
// ---------------------------------------------------------------------------
const digestSchema = z.object({
  digestEnabled: z.boolean().optional(),
  digestEmail: z.string().email().optional().nullable(),
  digestDay: z.number().int().min(0).max(6).optional(),
});

router.put('/digest/:userId', async (req: Request, res: Response) => {
  const sessionUserId = verifyParentalSession(req.headers['x-parental-session'] as string | undefined);
  if (!sessionUserId) {
    res.status(401).json({ error: 'Parental session required' });
    return;
  }

  const parsed = digestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    return;
  }

  const userId = req.params.userId;
  const profile = await prisma.parentalProfile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(404).json({ error: 'Parental profile not found' });
    return;
  }

  const updated = await prisma.parentalProfile.update({
    where: { userId },
    data: parsed.data,
  });

  res.json(formatProfile(updated));
});

// ---------------------------------------------------------------------------
// GET /api/parents/digest/:userId — Get digest preferences
// ---------------------------------------------------------------------------
router.get('/digest/:userId', async (req: Request, res: Response) => {
  const sessionUserId = verifyParentalSession(req.headers['x-parental-session'] as string | undefined);
  if (!sessionUserId) {
    res.status(401).json({ error: 'Parental session required' });
    return;
  }

  const profile = await prisma.parentalProfile.findUnique({
    where: { userId: req.params.userId },
  });

  if (!profile) {
    res.status(404).json({ error: 'Parental profile not found' });
    return;
  }

  res.json({
    digestEnabled: profile.digestEnabled,
    digestEmail: profile.digestEmail,
    digestDay: profile.digestDay,
    lastDigestSentAt: profile.lastDigestSentAt?.toISOString() ?? null,
  });
});

// ---------------------------------------------------------------------------
// GET /api/parents/digest/:userId/preview — Preview digest data (JSON)
// ---------------------------------------------------------------------------
router.get('/digest/:userId/preview', async (req: Request, res: Response) => {
  const sessionUserId = verifyParentalSession(req.headers['x-parental-session'] as string | undefined);
  if (!sessionUserId) {
    res.status(401).json({ error: 'Parental session required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const data = await generateDigestData(req.params.userId);
  res.json(data);
});

// ---------------------------------------------------------------------------
// GET /api/parents/digest/:userId/download — Download digest as PDF
// ---------------------------------------------------------------------------
router.get('/digest/:userId/download', async (req: Request, res: Response) => {
  const sessionUserId = verifyParentalSession(req.headers['x-parental-session'] as string | undefined);
  if (!sessionUserId) {
    res.status(401).json({ error: 'Parental session required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const locale = (req.query.locale === 'en' ? 'en' : 'es') as 'es' | 'en';
  const data = await generateDigestData(req.params.userId);
  const pdfBuffer = await renderDigestPdf(data, locale);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sportykids-digest-${req.params.userId}.pdf"`);
  res.send(pdfBuffer);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatProfile({ pin, failedAttempts, lockedUntil, ...rest }: Record<string, unknown>) {
  return {
    ...rest,
    allowedSports: safeJsonParse(rest.allowedSports as string, []),
    allowedFeeds: safeJsonParse(rest.allowedFeeds as string, []),
    allowedFormats: safeJsonParse(rest.allowedFormats as string, []),
    digestEnabled: rest.digestEnabled ?? false,
    digestEmail: rest.digestEmail ?? null,
    digestDay: rest.digestDay ?? 1,
    lastDigestSentAt: rest.lastDigestSentAt instanceof Date
      ? (rest.lastDigestSentAt as Date).toISOString()
      : (rest.lastDigestSentAt ?? null),
    allowedHoursStart: rest.allowedHoursStart ?? 7,
    allowedHoursEnd: rest.allowedHoursEnd ?? 21,
    timezone: rest.timezone ?? 'Europe/Madrid',
  };
}

export default router;
