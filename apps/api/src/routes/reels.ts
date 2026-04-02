import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Parser from 'rss-parser';
import { prisma } from '../config/database';
import { parentalGuard } from '../middleware/parental-guard';
import { subscriptionGuard } from '../middleware/subscription-guard';
import { requireAuth, requireRole } from '../middleware/auth';
import { isPublicUrl } from '../utils/url-validator';
import { withCache, CACHE_TTL } from '../services/cache';
import { syncAllVideoSources } from '../services/video-aggregator';
import { ValidationError, NotFoundError, ConflictError, AuthenticationError, AuthorizationError } from '../errors';

const parser = new Parser({ timeout: 10000 });

const router = Router();

const filtersSchema = z.object({
  sport: z.string().optional(),
  age: z.coerce.number().int().min(4).max(18).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// GET /api/reels — Reels feed with filters (only approved content)
router.get('/', parentalGuard, subscriptionGuard('reels'), async (req: Request, res: Response) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid parameters', parsed.error.flatten());
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
    throw new ValidationError('Invalid parameters', parsed.error.flatten());
  }

  const { name, feedUrl, platform, sport, userId, channelId, playlistId } = parsed.data;

  // Verify user exists
  const requestUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!requestUser) {
    throw new NotFoundError('User not found');
  }

  // SSRF prevention
  const urlCheck = isPublicUrl(feedUrl);
  if (!urlCheck.valid) {
    throw new ValidationError(urlCheck.reason ?? 'Invalid URL');
  }

  // Validate RSS feed for YouTube platform sources
  if (platform.startsWith('youtube_')) {
    try {
      await parser.parseURL(feedUrl);
    } catch {
      throw new ValidationError('URL does not appear to be a valid RSS feed');
    }
  }

  // Dedup check
  const existing = await prisma.videoSource.findUnique({ where: { feedUrl } });
  if (existing) {
    throw new ConflictError('Video source with this feed URL already exists');
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
    throw new AuthenticationError('Authentication required');
  }

  const requestUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!requestUser) {
    throw new NotFoundError('User not found');
  }

  const source = await prisma.videoSource.findUnique({ where: { id: req.params.id as string } });
  if (!source) {
    throw new NotFoundError('Video source not found');
  }

  if (!source.isCustom) {
    throw new AuthorizationError('Cannot delete catalog sources. Only custom sources can be deleted.');
  }

  if (source.addedBy && source.addedBy !== userId) {
    throw new AuthorizationError('You can only delete sources you created');
  }

  await prisma.videoSource.delete({ where: { id: source.id } });
  res.json({ message: 'Custom video source deleted', id: source.id });
});

// POST /api/reels/sync — Manual video synchronization (parent only)
router.post('/sync', requireAuth, requireRole('parent'), async (_req: Request, res: Response) => {
  const result = await syncAllVideoSources();
  res.json(result);
});

// GET /api/reels/:id — Reel detail
router.get('/:id', parentalGuard, subscriptionGuard('reels'), async (req: Request, res: Response) => {
  const reel = await prisma.reel.findUnique({ where: { id: req.params.id as string } });
  if (!reel) {
    throw new NotFoundError('Reel not found');
  }
  res.json(reel);
});

export default router;
