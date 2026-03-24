import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { awardPointsForActivity } from '../services/gamification';
import { invalidateProfileCache } from '../middleware/parental-guard';

const router = Router();

// ---------------------------------------------------------------------------
// Session token store (in-memory, 5-min expiry)
// ---------------------------------------------------------------------------
const parentSessions = new Map<string, { userId: string; expiresAt: number }>();

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired sessions every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of parentSessions) {
    if (session.expiresAt <= now) {
      parentSessions.delete(token);
    }
  }
}, 60_000);

function createSession(userId: string): { sessionToken: string; expiresAt: number } {
  const sessionToken = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  parentSessions.set(sessionToken, { userId, expiresAt });
  return { sessionToken, expiresAt };
}

/** Check if a stored hash is a legacy SHA-256 hex string (64 hex chars) */
function isSha256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

function hashPinSha256(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

// ---------------------------------------------------------------------------
// POST /api/parents/configurar — Create parental profile with PIN (bcrypt)
// ---------------------------------------------------------------------------
const configureSchema = z.object({
  userId: z.string(),
  pin: z.string().length(4).regex(/^\d{4}$/),
  allowedSports: z.array(z.string()).optional(),
  allowedFormats: z.array(z.enum(['news', 'reels', 'quiz'])).optional(),
  maxDailyTimeMinutes: z.number().int().min(0).max(480).optional(),
});

router.post('/configurar', async (req: Request, res: Response) => {
  const parsed = configureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    return;
  }

  const { userId, pin, allowedSports, allowedFormats, maxDailyTimeMinutes } = parsed.data;

  const hashedPin = await bcrypt.hash(pin, 10);

  const profile = await prisma.parentalProfile.upsert({
    where: { userId },
    update: {
      pin: hashedPin,
      ...(allowedSports && { allowedSports: JSON.stringify(allowedSports) }),
      ...(allowedFormats && { allowedFormats: JSON.stringify(allowedFormats) }),
      ...(maxDailyTimeMinutes !== undefined && maxDailyTimeMinutes !== null && { maxDailyTimeMinutes }),
    },
    create: {
      userId,
      pin: hashedPin,
      allowedSports: JSON.stringify(allowedSports ?? []),
      allowedFormats: JSON.stringify(allowedFormats ?? ['news', 'reels', 'quiz']),
      maxDailyTimeMinutes: maxDailyTimeMinutes ?? 60,
    },
  });

  // Invalidate parental guard cache after profile change
  invalidateProfileCache(userId);

  res.json(formatProfile(profile));
});

// ---------------------------------------------------------------------------
// POST /api/parents/verificar-pin — Verify PIN (bcrypt with SHA-256 migration)
// ---------------------------------------------------------------------------
const verifySchema = z.object({
  userId: z.string(),
  pin: z.string().length(4),
});

router.post('/verificar-pin', async (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  const profile = await prisma.parentalProfile.findUnique({
    where: { userId: parsed.data.userId },
  });

  if (!profile) {
    res.json({ verified: false, exists: false });
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
    const session = createSession(parsed.data.userId);
    res.json({
      verified: true,
      exists: true,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      profile: formatProfile(profile),
    });
  } else {
    res.json({ verified: false, exists: true });
  }
});

// ---------------------------------------------------------------------------
// GET /api/parents/perfil/:userId — Get parental profile
// ---------------------------------------------------------------------------
router.get('/perfil/:userId', async (req: Request, res: Response) => {
  const profile = await prisma.parentalProfile.findUnique({
    where: { userId: req.params.userId },
  });

  if (!profile) {
    res.json({ exists: false });
    return;
  }

  res.json({ exists: true, profile: formatProfile(profile) });
});

// ---------------------------------------------------------------------------
// PUT /api/parents/perfil/:userId — Update restrictions
// ---------------------------------------------------------------------------
const updateSchema = z.object({
  allowedSports: z.array(z.string()).optional(),
  allowedFormats: z.array(z.enum(['news', 'reels', 'quiz'])).optional(),
  maxDailyTimeMinutes: z.number().int().min(0).max(480).optional(),
});

router.put('/perfil/:userId', async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  const { allowedSports, allowedFormats, maxDailyTimeMinutes } = parsed.data;
  const data: Record<string, unknown> = {};
  if (allowedSports) data.allowedSports = JSON.stringify(allowedSports);
  if (allowedFormats) data.allowedFormats = JSON.stringify(allowedFormats);
  if (maxDailyTimeMinutes !== undefined && maxDailyTimeMinutes !== null) data.maxDailyTimeMinutes = maxDailyTimeMinutes;

  const profile = await prisma.parentalProfile.update({
    where: { userId: req.params.userId },
    data,
  });

  // Invalidate parental guard cache after profile change
  invalidateProfileCache(req.params.userId);

  res.json(formatProfile(profile));
});

// ---------------------------------------------------------------------------
// GET /api/parents/actividad/:userId — Weekly summary
// ---------------------------------------------------------------------------
router.get('/actividad/:userId', async (req: Request, res: Response) => {
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
// GET /api/parents/actividad/:userId/detalle — Detailed activity breakdown
// ---------------------------------------------------------------------------
const detailQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

router.get('/actividad/:userId/detalle', async (req: Request, res: Response) => {
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
// POST /api/parents/actividad/registrar — Log activity (with detail fields)
// ---------------------------------------------------------------------------
const logSchema = z.object({
  userId: z.string(),
  type: z.enum(['news_viewed', 'reels_viewed', 'quizzes_played']),
  durationSeconds: z.number().int().min(0).optional(),
  contentId: z.string().optional(),
  sport: z.string().optional(),
});

router.post('/actividad/registrar', async (req: Request, res: Response) => {
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

  // Award points for activity (news_viewed, reels_viewed)
  const gamificationResult = await awardPointsForActivity(
    parsed.data.userId,
    parsed.data.type,
  );

  res.json({
    ok: true,
    pointsAwarded: gamificationResult.pointsAwarded,
    newAchievements: gamificationResult.newAchievements,
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function safeJsonParse(value: unknown, fallback: unknown[] = []): unknown {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatProfile(profile: Record<string, unknown>) {
  return {
    ...profile,
    pin: undefined, // Never return the PIN
    allowedSports: safeJsonParse(profile.allowedSports),
    allowedFeeds: safeJsonParse(profile.allowedFeeds),
    allowedFormats: safeJsonParse(profile.allowedFormats),
  };
}

export default router;
