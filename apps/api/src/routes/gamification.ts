import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { checkAndUpdateStreak } from '../services/gamification';
import { withCache, CACHE_TTL, apiCache } from '../services/cache';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/gamification/stickers — All stickers catalog
// ---------------------------------------------------------------------------

router.get('/stickers', withCache('stickers:catalog:', CACHE_TTL.STICKERS_CATALOG), async (_req: Request, res: Response) => {
  const stickers = await prisma.sticker.findMany({
    orderBy: [{ rarity: 'asc' }, { sport: 'asc' }, { name: 'asc' }],
  });
  res.json({ stickers, total: stickers.length });
});

// ---------------------------------------------------------------------------
// GET /api/gamification/stickers/:userId — User's collected stickers
// ---------------------------------------------------------------------------

router.get('/stickers/:userId', async (req: Request, res: Response) => {
  const userId = req.params.userId as string;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const totalStickers = await prisma.sticker.count();
  const userStickers = await prisma.userSticker.findMany({
    where: { userId },
    include: { sticker: true },
    orderBy: { obtainedAt: 'desc' },
  });

  res.json({
    collected: userStickers.length,
    total: totalStickers,
    stickers: userStickers.map((us) => ({
      id: us.sticker.id,
      name: us.sticker.name,
      nameKey: us.sticker.nameKey,
      imageUrl: us.sticker.imageUrl,
      sport: us.sticker.sport,
      team: us.sticker.team,
      rarity: us.sticker.rarity,
      obtainedAt: us.obtainedAt,
      source: us.source,
    })),
  });
});

// ---------------------------------------------------------------------------
// GET /api/gamification/achievements — All achievement definitions
// ---------------------------------------------------------------------------

router.get('/achievements', async (_req: Request, res: Response) => {
  const achievements = await prisma.achievement.findMany({
    orderBy: [{ type: 'asc' }, { threshold: 'asc' }],
  });
  res.json({ achievements, total: achievements.length });
});

// ---------------------------------------------------------------------------
// GET /api/gamification/achievements/:userId — User's unlocked achievements
// ---------------------------------------------------------------------------

router.get('/achievements/:userId', async (req: Request, res: Response) => {
  const userId = req.params.userId as string;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const totalAchievements = await prisma.achievement.count();
  const userAchievements = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { unlockedAt: 'desc' },
  });

  res.json({
    unlocked: userAchievements.length,
    total: totalAchievements,
    achievements: userAchievements.map((ua) => ({
      key: ua.achievement.key,
      nameKey: ua.achievement.nameKey,
      descriptionKey: ua.achievement.descriptionKey,
      icon: ua.achievement.icon,
      threshold: ua.achievement.threshold,
      type: ua.achievement.type,
      unlockedAt: ua.unlockedAt,
    })),
  });
});

// ---------------------------------------------------------------------------
// GET /api/gamification/streaks/:userId — Streak info
// ---------------------------------------------------------------------------

router.get('/streaks/:userId', async (req: Request, res: Response) => {
  const userId = req.params.userId as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentStreak: true,
      longestStreak: true,
      lastActiveDate: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

// ---------------------------------------------------------------------------
// POST /api/gamification/check-in — Daily streak check-in
// ---------------------------------------------------------------------------

const checkInSchema = z.object({
  userId: z.string(),
});

router.post('/check-in', async (req: Request, res: Response) => {
  const parsed = checkInSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid data' });
    return;
  }

  const { userId } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const result = await checkAndUpdateStreak(userId);
  // Invalidate behavioral signals cache after check-in
  apiCache.invalidate(`behavioral:${userId}`);
  res.json(result);
});

export default router;
