import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Parser from 'rss-parser';
import { prisma } from '../config/database';
import { parentalGuard } from '../middleware/parental-guard';
import { requireAuth, requireRole } from '../middleware/auth';
import { isPublicUrl } from '../utils/url-validator';
import { withCache, CACHE_TTL } from '../services/cache';
import { syncAllVideoSources } from '../services/video-aggregator';

const parser = new Parser({ timeout: 10000 });

const router = Router();

const filtersSchema = z.object({
  sport: z.string().optional(),
  age: z.coerce.number().int().min(4).max(18).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// GET /api/reels — Reels feed with filters (only approved content)
router.get('/', parentalGuard, async (req: Request, res: Response) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten() });
    return;
  }

  const { sport, age, page, limit } = parsed.data;
  const where: Record<string, unknown> = { safetyStatus: 'approved' };
  if (sport) where.sport = sport;
  if (age) {
    where.minAge = { lte: age };
    where.maxAge = { gte: age };
  }

  const [reels, total] = await Promise.all([
    prisma.reel.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.reel.count({ where }),
  ]);

  res.json({ reels, total, page, totalPages: Math.ceil(total / limit) });
});

// GET /api/reels/sources/list — Active video sources (cached 10min)
router.get('/sources/list', withCache('video-sources:', CACHE_TTL.SOURCES), async (_req: Request, res: Response) => {
  const sources = await prisma.videoSource.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  res.json({ sources });
});

// GET /api/reels/sources/catalog — Full video source catalog with stats
router.get('/sources/catalog', async (_req: Request, res: Response) => {
  const [sources, total, sportGroups] = await Promise.all([
    prisma.videoSource.findMany({ orderBy: { sport: 'asc' } }),
    prisma.videoSource.count(),
    prisma.videoSource.groupBy({
      by: ['sport'],
      _count: { sport: true },
    }),
  ]);

  const bySport: Record<string, number> = {};
  for (const group of sportGroups) {
    bySport[group.sport] = group._count.sport;
  }

  res.json({ sources, total, bySport });
});

// POST /api/reels/sources/custom — Add a custom video source
router.post('/sources/custom', requireAuth, async (req: Request, res: Response) => {
  const bodySchema = z.object({
    name: z.string().min(1).max(200),
    feedUrl: z.string().url(),
    platform: z.enum(['youtube_channel', 'youtube_playlist', 'instagram_account', 'tiktok_account', 'manual']),
    sport: z.string().min(1),
    userId: z.string().min(1),
    channelId: z.string().optional(),
    playlistId: z.string().optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten() });
    return;
  }

  const { name, feedUrl, platform, sport, userId, channelId, playlistId } = parsed.data;

  // Verify user exists
  const requestUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!requestUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // SSRF prevention
  const urlCheck = isPublicUrl(feedUrl);
  if (!urlCheck.valid) {
    res.status(400).json({ error: urlCheck.reason });
    return;
  }

  // Validate RSS feed for YouTube platform sources
  if (platform.startsWith('youtube_')) {
    try {
      await parser.parseURL(feedUrl);
    } catch {
      res.status(422).json({ error: 'URL does not appear to be a valid RSS feed' });
      return;
    }
  }

  // Dedup check
  const existing = await prisma.videoSource.findUnique({ where: { feedUrl } });
  if (existing) {
    res.status(409).json({ error: 'Video source with this feed URL already exists', existingId: existing.id });
    return;
  }

  const source = await prisma.videoSource.create({
    data: {
      name,
      feedUrl,
      platform,
      sport,
      channelId: channelId ?? null,
      playlistId: playlistId ?? null,
      isCustom: true,
      addedBy: userId,
    },
  });

  res.status(201).json(source);
});

// DELETE /api/reels/sources/custom/:id — Delete a custom video source
router.delete('/sources/custom/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const requestUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!requestUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const source = await prisma.videoSource.findUnique({ where: { id: req.params.id as string } });
  if (!source) {
    res.status(404).json({ error: 'Video source not found' });
    return;
  }

  if (!source.isCustom) {
    res.status(403).json({ error: 'Cannot delete catalog sources. Only custom sources can be deleted.' });
    return;
  }

  if (source.addedBy && source.addedBy !== userId) {
    res.status(403).json({ error: 'You can only delete sources you created' });
    return;
  }

  await prisma.videoSource.delete({ where: { id: source.id } });
  res.json({ message: 'Custom video source deleted', id: source.id });
});

// POST /api/reels/sync — Manual video synchronization (parent only)
router.post('/sync', requireAuth, requireRole('parent'), async (_req: Request, res: Response) => {
  try {
    const result = await syncAllVideoSources();
    res.json(result);
  } catch (err) {
    console.error('[REELS SYNC] Manual sync failed:', err);
    res.status(500).json({ error: 'Video sync failed', message: (err as Error).message });
  }
});

// GET /api/reels/:id — Reel detail
router.get('/:id', parentalGuard, async (req: Request, res: Response) => {
  const reel = await prisma.reel.findUnique({ where: { id: req.params.id as string } });
  if (!reel) {
    res.status(404).json({ error: 'Reel not found' });
    return;
  }
  res.json(reel);
});

export default router;
