import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Parser from 'rss-parser';
import { prisma } from '../config/database';
import { runManualSync } from '../jobs/sync-feeds';
import { syncSource } from '../services/aggregator';
import { generateSummary } from '../services/summarizer';
import type { AgeRange } from '../services/summarizer';
import type { Locale } from '@sportykids/shared';
import { parentalGuard } from '../middleware/parental-guard';
import { rankFeed } from '../services/feed-ranker';

const router = Router();

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'SportyKids/1.0 (Sports news aggregator)',
  },
});

const filtersSchema = z.object({
  sport: z.string().optional(),
  team: z.string().optional(),
  age: z.coerce.number().int().min(4).max(18).optional(),
  source: z.string().optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/news — List with filters and pagination (only approved content)
router.get('/', parentalGuard, async (req: Request, res: Response) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten() });
    return;
  }

  const { sport, team, age, source, userId, page, limit } = parsed.data;

  const where: Record<string, unknown> = {
    safetyStatus: 'approved',
  };
  if (sport) where.sport = sport;
  if (team) where.team = { contains: team };
  if (source) where.source = { contains: source };
  if (age) {
    where.minAge = { lte: age };
    where.maxAge = { gte: age };
  }

  // Filter by user's selected feeds (source names from their chosen RSS sources)
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { selectedFeeds: true } });
    if (user?.selectedFeeds) {
      try {
        const feedIds: string[] = JSON.parse(user.selectedFeeds);
        if (feedIds.length > 0) {
          // Resolve feed IDs to source names
          const selectedSources = await prisma.rssSource.findMany({
            where: { id: { in: feedIds } },
            select: { name: true },
          });
          const sourceNames = selectedSources.map((s) => s.name);
          if (sourceNames.length > 0) {
            where.source = { in: sourceNames };
          }
        }
      } catch {
        // Invalid JSON in selectedFeeds — ignore filter
      }
    }
  }

  // When a userId is present and user has preferences, we need to fetch ALL matching
  // items first so the ranker can score and reorder them, then paginate the result.
  // This is acceptable for MVP but should be replaced with DB-level scoring for scale.
  let userPrefs: { favoriteSports: string[]; favoriteTeam?: string | null } | null = null;

  if (userId) {
    const prefUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteSports: true, favoriteTeam: true },
    });
    if (prefUser) {
      try {
        const sports: string[] = JSON.parse(prefUser.favoriteSports);
        if (sports.length > 0) {
          userPrefs = { favoriteSports: sports, favoriteTeam: prefUser.favoriteTeam };
        }
      } catch {
        // Invalid JSON — skip ranking
      }
    }
  }

  if (userPrefs) {
    // Fetch matching items (with safety limit) so ranker can reorder
    const allNews = await prisma.newsItem.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: 500,
    });

    const ranked = rankFeed(allNews, userPrefs);
    const total = ranked.length;
    const paginated = ranked.slice((page - 1) * limit, page * limit);

    res.json({
      news: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } else {
    // No user prefs — standard DB pagination
    const [news, total] = await Promise.all([
      prisma.newsItem.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.newsItem.count({ where }),
    ]);

    res.json({
      news,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  }
});

// GET /api/news/fuentes/listado — List active RSS sources
router.get('/fuentes/listado', async (_req: Request, res: Response) => {
  const sources = await prisma.rssSource.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  res.json(sources);
});

// GET /api/news/fuentes/catalogo — All sources with metadata and bySport counts
router.get('/fuentes/catalogo', async (_req: Request, res: Response) => {
  const sources = await prisma.rssSource.findMany({
    orderBy: { name: 'asc' },
  });

  // Compute counts by sport
  const bySport: Record<string, number> = {};
  for (const source of sources) {
    bySport[source.sport] = (bySport[source.sport] || 0) + 1;
  }

  res.json({
    sources,
    total: sources.length,
    bySport,
  });
});

// POST /api/news/fuentes/custom — Add a custom RSS source
router.post('/fuentes/custom', async (req: Request, res: Response) => {
  const bodySchema = z.object({
    name: z.string().min(1).max(200),
    url: z.string().url(),
    sport: z.string().min(1),
    userId: z.string().min(1),
    country: z.string().default('ES'),
    language: z.string().default('es'),
    description: z.string().default(''),
    category: z.string().default('general'),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten() });
    return;
  }

  const { name, url, sport, userId, country, language, description, category } = parsed.data;

  // Verify the user exists
  const requestUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!requestUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // SSRF prevention: reject internal/private network URLs
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const scheme = parsedUrl.protocol;

    // Only allow http and https schemes
    if (scheme !== 'http:' && scheme !== 'https:') {
      res.status(400).json({ error: 'Only HTTP and HTTPS URLs are allowed' });
      return;
    }

    // Block localhost and loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
      res.status(400).json({ error: 'Internal URLs are not allowed' });
      return;
    }

    // Block private IP ranges
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      if (
        a === 10 ||                              // 10.x.x.x
        (a === 172 && b >= 16 && b <= 31) ||     // 172.16-31.x.x
        (a === 192 && b === 168)                  // 192.168.x.x
      ) {
        res.status(400).json({ error: 'Internal URLs are not allowed' });
        return;
      }
    }
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  // Check if source URL already exists
  const existing = await prisma.rssSource.findUnique({ where: { url } });
  if (existing) {
    res.status(409).json({ error: 'RSS source with this URL already exists', existingId: existing.id });
    return;
  }

  // Validate URL is a valid RSS feed
  try {
    await parser.parseURL(url);
  } catch {
    res.status(422).json({ error: 'URL does not appear to be a valid RSS feed' });
    return;
  }

  // Create the custom source
  const source = await prisma.rssSource.create({
    data: {
      name,
      url,
      sport,
      country,
      language,
      description,
      category,
      isCustom: true,
      active: true,
    },
  });

  // Sync immediately
  let syncResult = null;
  try {
    syncResult = await syncSource(source.id, source.name, source.url, source.sport);
  } catch (err) {
    console.error(`Error syncing new custom source ${name}:`, err);
  }

  res.status(201).json({
    source,
    syncResult,
  });
});

// DELETE /api/news/fuentes/custom/:id — Delete a custom source only
router.delete('/fuentes/custom/:id', async (req: Request, res: Response) => {
  // Require userId for basic authorization
  const userId = (req.query.userId as string) || (req.body?.userId as string);
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const requestUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!requestUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const source = await prisma.rssSource.findUnique({
    where: { id: req.params.id },
  });

  if (!source) {
    res.status(404).json({ error: 'RSS source not found' });
    return;
  }

  if (!source.isCustom) {
    res.status(403).json({ error: 'Cannot delete catalog sources. Only custom sources can be deleted.' });
    return;
  }

  await prisma.rssSource.delete({ where: { id: source.id } });
  res.json({ message: 'Custom source deleted', id: source.id });
});

// POST /api/news/sincronizar — Manual synchronization with moderation stats
router.post('/sincronizar', async (_req: Request, res: Response) => {
  const result = await runManualSync();
  res.json({
    message: 'Synchronization complete',
    totalProcessed: result.totalProcessed,
    totalCreated: result.totalCreated,
    moderation: {
      approved: result.totalApproved,
      rejected: result.totalRejected,
      errors: result.totalErrors,
    },
    sources: result.sources.map((s) => ({
      name: s.sourceName,
      processed: s.itemsProcessed,
      created: s.itemsCreated,
      approved: s.moderationApproved,
      rejected: s.moderationRejected,
    })),
  });
});

// GET /api/news/:id/resumen — Age-adapted summary
router.get('/:id/resumen', async (req: Request, res: Response) => {
  const summaryParamsSchema = z.object({
    age: z.coerce.number().int().min(4).max(18).default(10),
    locale: z.enum(['es', 'en']).default('es'),
  });

  const parsed = summaryParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten() });
    return;
  }

  const { age, locale } = parsed.data;

  // Map age to range
  let ageRange: AgeRange;
  if (age <= 8) {
    ageRange = '6-8';
  } else if (age <= 11) {
    ageRange = '9-11';
  } else {
    ageRange = '12-14';
  }

  // Try to find cached summary
  const cached = await prisma.newsSummary.findUnique({
    where: {
      newsItemId_ageRange_locale: {
        newsItemId: req.params.id,
        ageRange,
        locale,
      },
    },
  });

  if (cached) {
    res.json({
      summary: cached.summary,
      ageRange,
      generatedAt: cached.createdAt,
    });
    return;
  }

  // Fetch the news item to generate on-demand
  const newsItem = await prisma.newsItem.findUnique({
    where: { id: req.params.id },
  });

  if (!newsItem || newsItem.safetyStatus !== 'approved') {
    res.status(404).json({ error: 'News item not found' });
    return;
  }

  // Generate on-demand
  const summaryText = await generateSummary(
    newsItem.title,
    newsItem.summary,
    ageRange,
    newsItem.sport,
    locale as Locale,
  );

  if (!summaryText) {
    res.status(503).json({ error: 'Summary generation unavailable. Try again later.' });
    return;
  }

  // Store in DB for future cache hits
  const stored = await prisma.newsSummary.upsert({
    where: {
      newsItemId_ageRange_locale: {
        newsItemId: req.params.id,
        ageRange,
        locale,
      },
    },
    update: { summary: summaryText },
    create: {
      newsItemId: req.params.id,
      ageRange,
      locale,
      summary: summaryText,
    },
  });

  res.json({
    summary: stored.summary,
    ageRange,
    generatedAt: stored.createdAt,
  });
});

// GET /api/news/:id — News item detail (only approved)
router.get('/:id', parentalGuard, async (req: Request, res: Response) => {
  const newsItem = await prisma.newsItem.findUnique({
    where: { id: req.params.id },
  });

  if (!newsItem || newsItem.safetyStatus !== 'approved') {
    res.status(404).json({ error: 'News item not found' });
    return;
  }

  res.json(newsItem);
});

export default router;
