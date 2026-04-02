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
import { subscriptionGuard } from '../middleware/subscription-guard';
import { requireAuth } from '../middleware/auth';
import { ValidationError, NotFoundError, ConflictError, AuthorizationError } from '../errors';
// Note: this file reads ActivityLog but does not create entries.
// All activity logging goes through POST /api/parents/activity/log (parents.ts),
// which calls invalidateBehavioralCache. If a future code path here creates
// ActivityLog entries, it must also call invalidateBehavioralCache.
import { rankFeed, getBehavioralSignals } from '../services/feed-ranker';
import { isPublicUrl } from '../utils/url-validator';
import { apiCache, CACHE_TTL, withCache } from '../services/cache';

const router = Router();

/** Strip diacritics and lowercase for accent-insensitive comparison */
function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

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
  q: z.string().optional(),
  locale: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/news — List with filters and pagination (only approved content)
router.get('/', parentalGuard, subscriptionGuard('news'), async (req: Request, res: Response) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid parameters', parsed.error.flatten());
  }

  const { sport, team, age, source, userId, q, locale, page, limit } = parsed.data;

  const conditions: Record<string, unknown>[] = [
    { safetyStatus: 'approved' },
  ];
  if (sport) conditions.push({ sport });
  // Team filter applied post-query with accent-insensitive matching (strip diacritics).
  // We require team to be non-null in the DB query and filter in JS after fetching.
  if (team) {
    conditions.push({ team: { not: null } });
  }
  if (source) conditions.push({ source: { contains: source } });

  // Text search — use OR for title/summary/team with case-insensitive matching (PostgreSQL)
  if (q && typeof q === 'string' && q.trim()) {
    const searchTerm = q.trim();
    conditions.push({
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' as const } },
        { summary: { contains: searchTerm, mode: 'insensitive' as const } },
        { team: { contains: searchTerm, mode: 'insensitive' as const } },
      ],
    });
  }

  if (age) {
    conditions.push({ minAge: { lte: age } });
    conditions.push({ maxAge: { gte: age } });
  }

  // Filter by user's selected feeds (source names from their chosen RSS sources)
  if (userId) {
    const feedUser = await prisma.user.findUnique({ where: { id: userId }, select: { selectedFeeds: true } });
    if (feedUser?.selectedFeeds && feedUser.selectedFeeds.length > 0) {
      const feedIds: string[] = feedUser.selectedFeeds;
      const selectedSources = await prisma.rssSource.findMany({
        where: { id: { in: feedIds } },
        select: { name: true },
      });
      const sourceNames = selectedSources.map((s) => s.name);
      if (sourceNames.length > 0) {
        conditions.push({ source: { in: sourceNames } });
      }
    }
  }

  const where: Record<string, unknown> = conditions.length === 1
    ? conditions[0]
    : { AND: conditions };

  // When a userId is present and user has preferences, we need to fetch ALL matching
  // items first so the ranker can score and reorder them, then paginate the result.
  // This is acceptable for MVP but should be replaced with DB-level scoring for scale.
  let userPrefs: { favoriteSports: string[]; favoriteTeam?: string | null } | null = null;
  let userLocale: string | undefined = locale;
  let userCountry: string | undefined;

  if (userId) {
    const prefUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteSports: true, favoriteTeam: true, locale: true, country: true },
    });
    if (prefUser) {
      userLocale = userLocale || prefUser.locale;
      userCountry = prefUser.country;
      const sports: string[] = prefUser.favoriteSports;
      if (sports.length > 0) {
        userPrefs = { favoriteSports: sports, favoriteTeam: prefUser.favoriteTeam };
      }
    }
  }

  // Accent-insensitive team filter applied in JS (diacritics-stripped comparison)
  const teamNorm = team ? normalizeText(team) : null;
  const matchesTeam = (item: { team?: string | null }) =>
    !teamNorm || (item.team && normalizeText(item.team).includes(teamNorm));

  if (userPrefs) {
    // Fetch matching items (with safety limit) so ranker can reorder
    let allNews = await prisma.newsItem.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: team ? 2000 : 500, // wider fetch when team-filtering in JS
    });

    // Apply accent-insensitive team filter
    if (teamNorm) {
      allNews = allNews.filter(matchesTeam);
    }

    // Enrich news items with source language/country from RssSource for ranking
    const sourceNames = [...new Set(allNews.map((n) => n.source))];
    const rssSources = sourceNames.length > 0
      ? await prisma.rssSource.findMany({
          where: { name: { in: sourceNames } },
          select: { name: true, language: true, country: true },
        })
      : [];
    const sourceMetaMap = new Map(rssSources.map((s) => [s.name, { language: s.language, country: s.country }]));
    const enrichedNews = allNews.map((item) => {
      const meta = sourceMetaMap.get(item.source);
      return { ...item, language: meta?.language ?? null, country: meta?.country ?? null };
    });

    // B-CP2: Get behavioral signals for personalized ranking
    const behavioral = userId ? await getBehavioralSignals(userId, userLocale, userCountry) : undefined;
    const ranked = rankFeed(enrichedNews, userPrefs, behavioral);
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
    let [news, total] = await Promise.all([
      prisma.newsItem.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: teamNorm ? 0 : (page - 1) * limit,
        take: teamNorm ? 500 : limit,
      }),
      prisma.newsItem.count({ where }),
    ]);

    // Apply accent-insensitive team filter
    if (teamNorm) {
      news = news.filter(matchesTeam);
      total = news.length;
      news = news.slice((page - 1) * limit, page * limit);
    }

    res.json({
      news,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  }
});

// GET /api/news/trending — News IDs that are trending (most viewed in last 24h)
const TRENDING_THRESHOLD = 5;
const TRENDING_LIMIT = 20;

router.get('/trending', withCache('trending:', CACHE_TTL.TRENDING), async (req: Request, res: Response) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // PostgreSQL-native GROUP BY + HAVING via Prisma groupBy
    const trending = await prisma.activityLog.groupBy({
      by: ['contentId'],
      where: {
        type: 'news_viewed',
        createdAt: { gte: since },
        contentId: { not: null },
      },
      _count: { contentId: true },
      having: { contentId: { _count: { gt: TRENDING_THRESHOLD } } },
      orderBy: { _count: { contentId: 'desc' } },
      take: TRENDING_LIMIT,
    });

    const trendingIds = trending
      .filter((t) => t.contentId !== null)
      .map((t) => t.contentId!);

    res.json({ trendingIds });
  } catch (err) {
    req.log.error({ err }, 'Error fetching trending news');
    res.json({ trendingIds: [] });
  }
});

// GET /api/news/sources/list — List active RSS sources
router.get('/sources/list', withCache('sources:', CACHE_TTL.SOURCES), async (_req: Request, res: Response) => {
  const sources = await prisma.rssSource.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  res.json(sources);
});

// GET /api/news/sources/catalog — All sources with metadata and bySport counts
router.get('/sources/catalog', async (_req: Request, res: Response) => {
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

// POST /api/news/sources/custom — Add a custom RSS source
router.post('/sources/custom', requireAuth, async (req: Request, res: Response) => {
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
    throw new ValidationError('Invalid parameters', parsed.error.flatten());
  }

  const { name, url, sport, userId, country, language, description, category } = parsed.data;

  // Verify the user exists
  const requestUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!requestUser) {
    throw new NotFoundError('User not found');
  }

  // SSRF prevention: reject internal/private network URLs
  const urlCheck = isPublicUrl(url);
  if (!urlCheck.valid) {
    throw new ValidationError(urlCheck.reason ?? 'Invalid URL');
  }

  // Check if source URL already exists
  const existing = await prisma.rssSource.findUnique({ where: { url } });
  if (existing) {
    throw new ConflictError('RSS source with this URL already exists');
  }

  // Validate URL is a valid RSS feed
  try {
    await parser.parseURL(url);
  } catch {
    throw new ValidationError('URL does not appear to be a valid RSS feed');
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
      addedBy: userId,
    },
  });

  // Sync immediately
  let syncResult = null;
  try {
    syncResult = await syncSource(source.id, source.name, source.url, source.sport);
  } catch (err) {
    req.log.error({ err }, `Error syncing new custom source ${name}`);
  }

  res.status(201).json({
    source,
    syncResult,
  });
});

// DELETE /api/news/sources/custom/:id — Delete a custom source only
router.delete('/sources/custom/:id', requireAuth, async (req: Request, res: Response) => {
  // Prefer JWT userId, fall back to query/body for backward compat
  const userId = req.auth?.userId || (req.query.userId as string) || (req.body?.userId as string);
  if (!userId) {
    throw new ValidationError('userId is required');
  }

  const requestUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!requestUser) {
    throw new NotFoundError('User not found');
  }

  const source = await prisma.rssSource.findUnique({
    where: { id: req.params.id },
  });

  if (!source) {
    throw new NotFoundError('RSS source not found');
  }

  if (!source.isCustom) {
    throw new AuthorizationError('Cannot delete catalog sources. Only custom sources can be deleted.');
  }

  // Verify ownership: only the user who added the source can delete it
  if (source.addedBy && source.addedBy !== userId) {
    throw new AuthorizationError('You can only delete sources you created');
  }

  await prisma.rssSource.delete({ where: { id: source.id } });
  res.json({ message: 'Custom source deleted', id: source.id });
});

// POST /api/news/sync — Manual synchronization with moderation stats
router.post('/sync', requireAuth, async (_req: Request, res: Response) => {
  const result = await runManualSync();
  // Invalidate news-related caches after sync
  apiCache.invalidatePattern('news:');
  apiCache.invalidatePattern('trending:');
  apiCache.invalidatePattern('sources:');
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

// GET /api/news/:id/summary — Age-adapted summary
router.get('/:id/summary', async (req: Request, res: Response) => {
  const summaryParamsSchema = z.object({
    age: z.coerce.number().int().min(4).max(18).default(10),
    locale: z.enum(['es', 'en']).default('es'),
  });

  const parsed = summaryParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid parameters', parsed.error.flatten());
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
    throw new NotFoundError('News item not found');
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
    // 503: AI summary service temporarily unavailable — keep inline as it's
    // a single-use edge case that doesn't warrant a new error class.
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Summary generation unavailable. Try again later.' } });
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

// GET /api/news/history — Reading history for a user (B-EN4)
router.get('/history', async (req: Request, res: Response) => {
  const historySchema = z.object({
    userId: z.string(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  });

  const parsed = historySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid parameters', parsed.error.flatten());
  }

  const { userId, page: hPage, limit: hLimit } = parsed.data;

  // Get recent activity logs for news_viewed, ordered by most recent first
  const logs = await prisma.activityLog.findMany({
    where: {
      userId,
      type: 'news_viewed',
      contentId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: hLimit * 2, // Fetch extra to account for duplicates
    skip: (hPage - 1) * hLimit,
    select: { contentId: true, createdAt: true },
  });

  // Deduplicate by contentId, preserving order
  const seen = new Set<string>();
  const uniqueIds: string[] = [];
  for (const log of logs) {
    if (log.contentId && !seen.has(log.contentId)) {
      seen.add(log.contentId);
      uniqueIds.push(log.contentId);
      if (uniqueIds.length >= hLimit) break;
    }
  }

  if (uniqueIds.length === 0) {
    res.json({ history: [], total: 0 });
    return;
  }

  // Fetch the news items
  const newsItems = await prisma.newsItem.findMany({
    where: {
      id: { in: uniqueIds },
      safetyStatus: 'approved',
    },
  });

  // Maintain the order from activity logs
  const newsMap = new Map(newsItems.map((n) => [n.id, n]));
  const history = uniqueIds
    .map((id) => newsMap.get(id))
    .filter(Boolean);

  res.json({ history, total: history.length });
});

// GET /api/news/:id/related — Content recommendations (B-CP4)
router.get('/:id/related', async (req: Request, res: Response) => {
  const limitParam = parseInt(req.query.limit as string) || 5;
  const limit = Math.min(limitParam, 10);

  const newsItem = await prisma.newsItem.findUnique({
    where: { id: req.params.id },
  });

  if (!newsItem || newsItem.safetyStatus !== 'approved') {
    throw new NotFoundError('News item not found');
  }

  // First try to find related articles by team (most relevant)
  let related: typeof newsItem[] = [];

  if (newsItem.team) {
    related = await prisma.newsItem.findMany({
      where: {
        id: { not: newsItem.id },
        team: { contains: newsItem.team },
        safetyStatus: 'approved',
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  // If not enough, fill with same-sport articles
  if (related.length < limit) {
    const remaining = limit - related.length;
    const existingIds = [newsItem.id, ...related.map((r) => r.id)];
    const sportRelated = await prisma.newsItem.findMany({
      where: {
        id: { notIn: existingIds },
        sport: newsItem.sport,
        safetyStatus: 'approved',
      },
      orderBy: { publishedAt: 'desc' },
      take: remaining,
    });
    related = [...related, ...sportRelated];
  }

  res.json({ related });
});

// GET /api/news/:id — News item detail (only approved)
router.get('/:id', parentalGuard, subscriptionGuard('news'), async (req: Request, res: Response) => {
  const newsItem = await prisma.newsItem.findUnique({
    where: { id: req.params.id },
  });

  if (!newsItem || newsItem.safetyStatus !== 'approved') {
    throw new NotFoundError('News item not found');
  }

  res.json(newsItem);
});

export default router;
