import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../config/database';

const router = Router();

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

// POST /api/parents/configurar — Create parental profile with PIN
const configureSchema = z.object({
  userId: z.string(),
  pin: z.string().length(4).regex(/^\d{4}$/),
  allowedSports: z.array(z.string()).optional(),
  allowedFormats: z.array(z.enum(['news', 'reels', 'quiz'])).optional(),
  maxDailyTimeMinutes: z.number().int().min(10).max(480).optional(),
});

router.post('/configurar', async (req: Request, res: Response) => {
  const parsed = configureSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    return;
  }

  const { userId, pin, allowedSports, allowedFormats, maxDailyTimeMinutes } = parsed.data;

  const profile = await prisma.parentalProfile.upsert({
    where: { userId },
    update: {
      pin: hashPin(pin),
      ...(allowedSports && { allowedSports: JSON.stringify(allowedSports) }),
      ...(allowedFormats && { allowedFormats: JSON.stringify(allowedFormats) }),
      ...(maxDailyTimeMinutes && { maxDailyTimeMinutes }),
    },
    create: {
      userId,
      pin: hashPin(pin),
      allowedSports: JSON.stringify(allowedSports ?? []),
      allowedFormats: JSON.stringify(allowedFormats ?? ['news', 'reels', 'quiz']),
      maxDailyTimeMinutes: maxDailyTimeMinutes ?? 60,
    },
  });

  res.json(formatProfile(profile));
});

// POST /api/parents/verificar-pin — Verify PIN
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

  const verified = profile.pin === hashPin(parsed.data.pin);
  res.json({ verified, exists: true, profile: verified ? formatProfile(profile) : undefined });
});

// GET /api/parents/perfil/:userId — Get parental profile
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

// PUT /api/parents/perfil/:userId — Update restrictions
const updateSchema = z.object({
  allowedSports: z.array(z.string()).optional(),
  allowedFormats: z.array(z.enum(['news', 'reels', 'quiz'])).optional(),
  maxDailyTimeMinutes: z.number().int().min(10).max(480).optional(),
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
  if (maxDailyTimeMinutes) data.maxDailyTimeMinutes = maxDailyTimeMinutes;

  const profile = await prisma.parentalProfile.update({
    where: { userId: req.params.userId },
    data,
  });

  res.json(formatProfile(profile));
});

// GET /api/parents/actividad/:userId — Weekly summary
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

// POST /api/parents/actividad/registrar — Log activity
const logSchema = z.object({
  userId: z.string(),
  type: z.enum(['news_viewed', 'reels_viewed', 'quizzes_played']),
});

router.post('/actividad/registrar', async (req: Request, res: Response) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  await prisma.activityLog.create({
    data: { userId: parsed.data.userId, type: parsed.data.type },
  });

  res.json({ ok: true });
});

function formatProfile(profile: Record<string, unknown>) {
  return {
    ...profile,
    pin: undefined, // Never return the PIN
    allowedSports: JSON.parse(profile.allowedSports as string),
    allowedFeeds: JSON.parse(profile.allowedFeeds as string),
    allowedFormats: JSON.parse(profile.allowedFormats as string),
  };
}

export default router;
