import { Router, type Request, type Response } from 'express';
import { z } from 'zod/v4';
import { Prisma } from '@prisma/client';
import Parser from 'rss-parser';
import { requireAuth, requireRole } from '../middleware/auth';
import { SPORTS } from '@sportykids/shared';
import { generateUniqueCode } from '../services/invite-code';

// Alias to allow mocking in tests
const AdminRssParser = Parser;
import { syncLimiter, adminJobLimiter } from '../middleware/rate-limiter';
import { prisma } from '../config/database';
import { logger } from '../services/logger';
import { generateDailyQuiz } from '../jobs/generate-daily-quiz';
import { apiCache, withCache } from '../services/cache';
import { KNOWN_JOBS, JOB_FREQUENCIES, triggerJob } from '../services/job-runner';
import { syncSingleSource } from '../services/aggregator';
import { syncSingleVideoSource } from '../services/video-aggregator';

const router = Router();

// ─── Named types for pending moderation rows ──────────────────────────────

type PendingNewsRow = {
  id: string;
  title: string;
  sport: string;
  source: string;
  safetyReason: string | null;
  createdAt: Date;
  sourceUrl: string;
  imageUrl: string;
};

type PendingReelRow = {
  id: string;
  title: string;
  sport: string;
  videoSourceId: string | null;
  safetyReason: string | null;
  createdAt: Date;
  videoUrl: string;
  thumbnailUrl: string;
};

const batchSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  type: z.enum(['news', 'reel']),
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(3).optional(),
}).refine((d) => d.action !== 'reject' || !!d.reason, {
  message: 'reason is required when action is reject',
  path: ['reason'],
});

const rejectBodySchema = z.object({
  reason: z.string().min(3),
});

const reportActionSchema = z.object({
  status: z.enum(['reviewed', 'dismissed', 'actioned']),
  action: z.enum(['reject_content']).optional(),
});

/**
 * GET /api/admin/moderation/pending
 *
 * Returns pending news and reels with optional filters and pagination.
 * Query params: type=news|reel, sport, source (rssSourceId or videoSourceId), page, limit
 *
 * Requires admin role.
 */
router.get(
  '/moderation/pending',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const type = req.query.type as string | undefined;
      const sport = req.query.sport as string | undefined;
      const source = req.query.source as string | undefined;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
      const offset = (page - 1) * limit;

      const now = Date.now();
      let newsItems: PendingNewsRow[] = [];
      let reelItems: PendingReelRow[] = [];
      let newsTotal = 0;
      let reelTotal = 0;

      // Fetch news items unless type=reel
      if (!type || type === 'news') {
        const newsWhere: Prisma.NewsItemWhereInput = { safetyStatus: 'pending' };
        if (sport) newsWhere.sport = sport;
        // Filter by rssSource: find sources matching source param, then filter by source name
        if (source) {
          const rssSource = await prisma.rssSource.findUnique({ where: { id: source } });
          if (rssSource) newsWhere.source = rssSource.name;
        }
        [newsItems, newsTotal] = await Promise.all([
          prisma.newsItem.findMany({
            where: newsWhere,
            take: 2000,
            select: {
              id: true,
              title: true,
              sport: true,
              source: true,
              safetyReason: true,
              createdAt: true,
              sourceUrl: true,
              imageUrl: true,
            },
            orderBy: { createdAt: 'asc' },
          }) as Promise<PendingNewsRow[]>,
          prisma.newsItem.count({ where: newsWhere }),
        ]);
      }

      // Fetch reel items unless type=news
      if (!type || type === 'reel') {
        const reelWhere: Prisma.ReelWhereInput = { safetyStatus: 'pending' };
        if (sport) reelWhere.sport = sport;
        if (source) reelWhere.videoSourceId = source;
        [reelItems, reelTotal] = await Promise.all([
          prisma.reel.findMany({
            where: reelWhere,
            take: 2000,
            select: {
              id: true,
              title: true,
              sport: true,
              videoSourceId: true,
              safetyReason: true,
              createdAt: true,
              videoUrl: true,
              thumbnailUrl: true,
            },
            orderBy: { createdAt: 'asc' },
          }) as Promise<PendingReelRow[]>,
          prisma.reel.count({ where: reelWhere }),
        ]);
      }

      // Resolve video source names for reels
      const videoSourceIds = [...new Set(reelItems.map((r) => r.videoSourceId).filter(Boolean) as string[])];
      const videoSources = videoSourceIds.length
        ? await prisma.videoSource.findMany({
            where: { id: { in: videoSourceIds } },
            select: { id: true, name: true },
          })
        : [];
      const videoSourceMap = new Map(videoSources.map((vs) => [vs.id, vs.name]));

      // Merge and sort
      const pending = [
        ...newsItems.map((n) => ({
          id: n.id,
          type: 'news' as const,
          title: n.title,
          sport: n.sport,
          source: n.source,
          safetyReason: n.safetyReason,
          pendingSinceMinutes: Math.round((now - new Date(n.createdAt).getTime()) / 60_000),
          url: n.sourceUrl,
          imageUrl: n.imageUrl || undefined,
        })),
        ...reelItems.map((r) => ({
          id: r.id,
          type: 'reel' as const,
          title: r.title,
          sport: r.sport,
          source: r.videoSourceId ? (videoSourceMap.get(r.videoSourceId) ?? r.videoSourceId) : '',
          safetyReason: r.safetyReason,
          pendingSinceMinutes: Math.round((now - new Date(r.createdAt).getTime()) / 60_000),
          url: r.videoUrl,
          imageUrl: r.thumbnailUrl || undefined,
        })),
      ];

      pending.sort(
        (a, b) => b.pendingSinceMinutes - a.pendingSinceMinutes,
      );

      const total = newsTotal + reelTotal;
      const items = pending.slice(offset, offset + limit);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      res.json({ items, total, page, totalPages });
    } catch (err) {
      logger.error({ err }, 'Error fetching pending moderation items');
      res.status(500).json({ error: 'Failed to fetch pending items' });
    }
  },
);

/**
 * PATCH /api/admin/content/:type/:id/approve
 * Approves a news item or reel.
 */
router.patch(
  '/content/:type/:id/approve',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { type, id } = req.params;

    if (type !== 'news' && type !== 'reel') {
      res.status(400).json({ error: 'type must be news or reel' });
      return;
    }

    try {
      const now = new Date();

      if (type === 'news') {
        const item = await prisma.newsItem.update({
          where: { id },
          data: { safetyStatus: 'approved', moderatedAt: now },
          select: { id: true, safetyStatus: true, moderatedAt: true },
        });
        res.json(item);
      } else {
        const item = await prisma.reel.update({
          where: { id },
          data: { safetyStatus: 'approved', moderatedAt: now },
          select: { id: true, safetyStatus: true, moderatedAt: true },
        });
        res.json(item);
      }
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        res.status(404).json({ error: 'Content not found' });
        return;
      }
      logger.error({ err, type, id }, 'Error approving content');
      res.status(500).json({ error: 'Failed to approve content' });
    }
  },
);

/**
 * PATCH /api/admin/content/:type/:id/reject
 * Rejects a news item or reel with a required reason.
 */
router.patch(
  '/content/:type/:id/reject',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { type, id } = req.params;

    if (type !== 'news' && type !== 'reel') {
      res.status(400).json({ error: 'type must be news or reel' });
      return;
    }

    const parsed = rejectBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'reason is required (min 3 chars)' });
      return;
    }

    const { reason } = parsed.data;
    const now = new Date();

    try {
      if (type === 'news') {
        const item = await prisma.newsItem.update({
          where: { id },
          data: { safetyStatus: 'rejected', safetyReason: reason, moderatedAt: now },
          select: { id: true, safetyStatus: true, safetyReason: true, moderatedAt: true },
        });
        res.json(item);
      } else {
        const item = await prisma.reel.update({
          where: { id },
          data: { safetyStatus: 'rejected', safetyReason: reason, moderatedAt: now },
          select: { id: true, safetyStatus: true, safetyReason: true, moderatedAt: true },
        });
        res.json(item);
      }
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        res.status(404).json({ error: 'Content not found' });
        return;
      }
      logger.error({ err, type, id }, 'Error rejecting content');
      res.status(500).json({ error: 'Failed to reject content' });
    }
  },
);

/**
 * POST /api/admin/content/batch
 * Approve or reject multiple items at once.
 */
router.post(
  '/content/batch',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }

    const { ids, type, action, reason } = parsed.data;
    const now = new Date();

    const updateData =
      action === 'approve'
        ? { safetyStatus: 'approved', moderatedAt: now }
        : { safetyStatus: 'rejected', safetyReason: reason, moderatedAt: now };

    try {
      let updated: { count: number };

      if (type === 'news') {
        updated = await prisma.newsItem.updateMany({
          where: { id: { in: ids } },
          data: updateData,
        });
      } else {
        updated = await prisma.reel.updateMany({
          where: { id: { in: ids } },
          data: updateData,
        });
      }

      res.json({ updated: updated.count });
    } catch (err) {
      logger.error({ err, type, action }, 'Error batch processing content');
      res.status(500).json({ error: 'Failed to process batch action' });
    }
  },
);

/**
 * GET /api/admin/reports
 * Returns all content reports with filters.
 * Query: status, contentType, page, limit
 */
router.get(
  '/reports',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const contentType = req.query.contentType as string | undefined;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const offset = (page - 1) * limit;

    try {
      const where: Prisma.ContentReportWhereInput = {};
      if (status) where.status = status;
      if (contentType) where.contentType = contentType;

      const [reports, total] = await Promise.all([
        prisma.contentReport.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.contentReport.count({ where }),
      ]);

      // Resolve reporter user info
      const userIds = [...new Set(reports.map((r) => r.userId))];
      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Resolve content titles
      const newsIds = reports.filter((r) => r.contentType === 'news').map((r) => r.contentId);
      const reelIds = reports.filter((r) => r.contentType === 'reel').map((r) => r.contentId);

      const [newsItems, reels] = await Promise.all([
        newsIds.length
          ? prisma.newsItem.findMany({ where: { id: { in: newsIds } }, select: { id: true, title: true, sourceUrl: true } })
          : [],
        reelIds.length
          ? prisma.reel.findMany({ where: { id: { in: reelIds } }, select: { id: true, title: true, videoUrl: true } })
          : [],
      ]);

      const contentMap = new Map<string, { title: string; url: string }>();
      newsItems.forEach((n) => contentMap.set(n.id, { title: n.title, url: n.sourceUrl }));
      reels.forEach((r) => contentMap.set(r.id, { title: r.title, url: r.videoUrl }));

      const items = reports.map((r) => {
        const user = userMap.get(r.userId);
        const content = contentMap.get(r.contentId);
        return {
          id: r.id,
          contentType: r.contentType,
          contentId: r.contentId,
          contentTitle: content?.title ?? null,
          reason: r.reason,
          details: r.comment ?? null,
          status: r.status,
          user: { id: r.userId, email: user?.email ?? null },
          createdAt: r.createdAt.toISOString(),
        };
      });

      const totalPages = Math.max(1, Math.ceil(total / limit));
      res.json({ items, total, page, totalPages });
    } catch (err) {
      logger.error({ err }, 'Error fetching admin reports');
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  },
);

/**
 * PATCH /api/admin/reports/:id
 * Update a content report's status. Optionally reject the associated content.
 */
router.patch(
  '/reports/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const parsed = reportActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const { status, action } = parsed.data;

    try {
      const report = await prisma.contentReport.findUnique({ where: { id } });
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      const updatedReport = await prisma.contentReport.update({
        where: { id },
        data: { status, reviewedAt: new Date() },
      });

      // Cascade: also reject the associated content if requested
      if (action === 'reject_content') {
        const rejectData = {
          safetyStatus: 'rejected',
          safetyReason: 'User report actioned',
          moderatedAt: new Date(),
        };
        if (report.contentType === 'news') {
          await prisma.newsItem.update({ where: { id: report.contentId }, data: rejectData }).catch(() => {
            // Ignore if content no longer exists
          });
        } else if (report.contentType === 'reel') {
          await prisma.reel.update({ where: { id: report.contentId }, data: rejectData }).catch(() => {
            // Ignore if content no longer exists
          });
        }
      }

      res.json({
        id: updatedReport.id,
        status: updatedReport.status,
        reviewedAt: updatedReport.reviewedAt?.toISOString() ?? null,
      });
    } catch (err) {
      logger.error({ err, id }, 'Error updating report');
      res.status(500).json({ error: 'Failed to update report' });
    }
  },
);

/**
 * POST /api/admin/quiz/generate
 *
 * Triggers quiz generation immediately (same logic as the daily cron).
 * Requires admin role.
 */
router.post(
  '/quiz/generate',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    logger.info('Manual quiz generation triggered via admin endpoint');
    try {
      const result = await generateDailyQuiz();
      res.json({ ok: true, generated: result.generated, errors: result.errors });
    } catch (err) {
      logger.error({ err }, 'Error generating quiz via admin endpoint');
      res.status(500).json({ error: 'Failed to generate quiz' });
    }
  },
);

// ---------------------------------------------------------------------------
// Helpers for /overview
// ---------------------------------------------------------------------------

type AlertSeverity = 'warning' | 'error';

interface OverviewAlert {
  type: string;
  severity: AlertSeverity;
  message: string;
  actionUrl: string;
}

function buildAlerts(
  pendingTotal: number,
  oldestPending: { createdAt: Date } | null,
  staleRss: Array<{ name: string; lastSyncedAt: Date | null }>,
): OverviewAlert[] {
  const alerts: OverviewAlert[] = [];

  if (pendingTotal > 50) {
    alerts.push({
      type: 'pending_content_critical',
      severity: 'error',
      message: `${pendingTotal} items pending — queue is growing faster than it is cleared`,
      actionUrl: '/admin/moderation',
    });
  } else if (pendingTotal > 0) {
    // Emit warning immediately when any items are pending; the 30-min value is
    // part of the message text only, not a gate condition (per PRD spec).
    const ageMsg =
      oldestPending
        ? Date.now() - new Date(oldestPending.createdAt).getTime() > 30 * 60 * 1000
          ? 'for over 30 minutes'
          : '(newest just arrived)'
        : '';
    alerts.push({
      type: 'pending_content',
      severity: 'warning',
      message: `${pendingTotal} items pending moderation ${ageMsg}`.trim(),
      actionUrl: '/admin/moderation',
    });
  }

  for (const source of staleRss) {
    const lastSync = source.lastSyncedAt ? new Date(source.lastSyncedAt) : null;
    const hoursAgo = lastSync
      ? Math.floor((Date.now() - lastSync.getTime()) / (60 * 60 * 1000))
      : null;
    alerts.push({
      type: 'stale_rss',
      severity: 'warning',
      message:
        hoursAgo !== null
          ? `${source.name} RSS source has not synced in ${hoursAgo}h`
          : `${source.name} RSS source has never synced`,
      actionUrl: '/admin/sources',
    });
  }

  return alerts;
}

function msUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return midnight.getTime() - now.getTime();
}

// ---------------------------------------------------------------------------
// GET /api/admin/overview
// ---------------------------------------------------------------------------

router.get(
  '/overview',
  requireAuth,
  requireRole('admin'),
  withCache('admin:overview', 5 * 60 * 1000),
  async (_req: Request, res: Response) => {
    try {
      const [totalUsers, pendingNews, pendingReels, activeSources, subscriptions, oldestPending, staleRss] =
        await Promise.all([
          prisma.user.count(),
          prisma.newsItem.count({ where: { safetyStatus: 'pending' } }),
          prisma.reel.count({ where: { safetyStatus: 'pending' } }),
          prisma.rssSource.count({ where: { active: true } }),
          prisma.user.groupBy({ by: ['subscriptionTier'], _count: true }),
          prisma.newsItem.findFirst({
            where: { safetyStatus: 'pending' },
            orderBy: { createdAt: 'asc' },
          }),
          prisma.rssSource.findMany({
            where: {
              active: true,
              OR: [
                { lastSyncedAt: null },
                { lastSyncedAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
              ],
            },
            select: { name: true, lastSyncedAt: true },
          }),
        ]);

      // DAU: distinct users with activity yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dauRows = await prisma.activityLog.findMany({
        where: { createdAt: { gte: yesterday, lt: today } },
        select: { userId: true },
        distinct: ['userId'],
      });

      const pendingTotal = pendingNews + pendingReels;
      const alerts = buildAlerts(pendingTotal, oldestPending, staleRss);

      const subBreakdown = { free: 0, premium: 0 };
      for (const row of subscriptions) {
        if (row.subscriptionTier === 'premium') {
          subBreakdown.premium = row._count;
        } else {
          subBreakdown.free += row._count;
        }
      }

      res.json({
        kpis: {
          totalUsers,
          dau: dauRows.length,
          pendingContent: pendingTotal,
          activeRssSources: activeSources,
        },
        alerts,
        subscriptionBreakdown: subBreakdown,
      });
    } catch (err) {
      logger.error({ err }, 'Error fetching admin overview');
      res.status(500).json({ error: 'Failed to fetch overview' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/activity-chart
// ---------------------------------------------------------------------------

router.get(
  '/analytics/activity-chart',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    // Cannot use withCache middleware here because the TTL is dynamic (time until
    // midnight UTC). withCache only supports fixed TTLs.
    const CACHE_KEY = 'admin:activity-chart';

    try {
      const cached = await Promise.resolve(apiCache.get<unknown[]>(CACHE_KEY));
      if (cached) {
        res.json(cached);
        return;
      }

      const rows = await prisma.$queryRaw<Array<{ date: Date; type: string; count: bigint }>>`
        SELECT DATE_TRUNC('day', "createdAt") AS date, type, COUNT(*) AS count
        FROM "ActivityLog"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', "createdAt"), type
        ORDER BY date ASC
      `;

      // Group by date
      const byDate = new Map<string, { newsViewed: number; reelsViewed: number; quizzesPlayed: number }>();
      for (const row of rows) {
        const dateStr = new Date(row.date).toISOString().split('T')[0];
        if (!byDate.has(dateStr)) {
          byDate.set(dateStr, { newsViewed: 0, reelsViewed: 0, quizzesPlayed: 0 });
        }
        const entry = byDate.get(dateStr)!;
        const count = Number(row.count);
        if (row.type === 'news_viewed') entry.newsViewed += count;
        else if (row.type === 'reels_viewed') entry.reelsViewed += count;
        else if (row.type === 'quizzes_played') entry.quizzesPlayed += count;
      }

      const result = Array.from(byDate.entries()).map(([date, counts]) => ({
        date,
        ...counts,
      }));

      // Cache until midnight UTC
      await Promise.resolve(apiCache.set(CACHE_KEY, result, msUntilMidnightUTC()));

      res.json(result);
    } catch (err) {
      logger.error({ err }, 'Error fetching activity chart data');
      res.status(500).json({ error: 'Failed to fetch activity chart' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/jobs
// ---------------------------------------------------------------------------

router.get(
  '/jobs',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      // Fetch last run for each known job in one query (bounded to 5 per job max)
      const recentRuns = await prisma.jobRun.findMany({
        where: { jobName: { in: KNOWN_JOBS } },
        orderBy: { startedAt: 'desc' },
        take: KNOWN_JOBS.length * 5,
      });

      // Group by jobName, take first (most recent)
      const lastRunByJob = new Map<string, (typeof recentRuns)[0]>();
      for (const run of recentRuns) {
        if (!lastRunByJob.has(run.jobName)) {
          lastRunByJob.set(run.jobName, run);
        }
      }

      const now = Date.now();
      const jobs = KNOWN_JOBS.map(name => {
        const lastRun = lastRunByJob.get(name) ?? null;
        const freq = JOB_FREQUENCIES[name] ?? 1440;

        let isStale = false;
        let statusLabel: 'OK' | 'STALE' | 'ERROR' | 'RUNNING' | 'NEVER' = 'NEVER';

        if (lastRun) {
          if (lastRun.status === 'running') {
            // If a run has been stuck in 'running' for longer than 3× its frequency,
            // the process likely crashed without updating the record — treat as ERROR.
            const runningAgeMs = now - new Date(lastRun.startedAt).getTime();
            const staleRunningThresholdMs = 3 * freq * 60_000;
            statusLabel = runningAgeMs > staleRunningThresholdMs ? 'ERROR' : 'RUNNING';
          } else if (lastRun.status === 'error') {
            statusLabel = 'ERROR';
          } else {
            // success — check if stale
            if (lastRun.finishedAt) {
              const ageMs = now - new Date(lastRun.finishedAt).getTime();
              isStale = ageMs > 2 * freq * 60_000;
            }
            statusLabel = isStale ? 'STALE' : 'OK';
          }
        }

        return {
          name,
          expectedFrequencyMinutes: freq,
          lastRun: lastRun
            ? {
                id: lastRun.id,
                startedAt: new Date(lastRun.startedAt).toISOString(),
                finishedAt: lastRun.finishedAt ? new Date(lastRun.finishedAt).toISOString() : null,
                status: lastRun.status,
                triggeredBy: lastRun.triggeredBy,
                output: lastRun.output,
              }
            : null,
          isStale,
          statusLabel,
        };
      });

      res.json({ jobs });
    } catch (err) {
      logger.error({ err }, 'Error fetching admin jobs');
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/jobs/:name/trigger
// ---------------------------------------------------------------------------

router.post(
  '/jobs/:name/trigger',
  requireAuth,
  requireRole('admin'),
  adminJobLimiter,
  async (req: Request, res: Response) => {
    const name = String(req.params.name);

    if (!KNOWN_JOBS.includes(name)) {
      res.status(404).json({ error: `Unknown job: ${name}` });
      return;
    }

    try {
      const adminUserId = req.auth?.userId ?? 'unknown';
      const result = await triggerJob(name, adminUserId);
      res.status(202).json(result);
    } catch (err) {
      logger.error({ err, jobName: name }, 'Error triggering job');
      res.status(500).json({ error: 'Failed to trigger job' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/jobs/:name/history
// ---------------------------------------------------------------------------

router.get(
  '/jobs/:name/history',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { name } = req.params;

    if (!KNOWN_JOBS.includes(name)) {
      res.status(404).json({ error: `Unknown job: ${name}` });
      return;
    }

    const limitParam = parseInt(String(req.query.limit ?? '20'), 10);
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 20 : limitParam), 50);

    try {
      const runs = await prisma.jobRun.findMany({
        where: { jobName: name },
        orderBy: { startedAt: 'desc' },
        take: limit,
      });

      const history = runs.map(run => ({
        id: run.id,
        startedAt: new Date(run.startedAt).toISOString(),
        finishedAt: run.finishedAt ? new Date(run.finishedAt).toISOString() : null,
        durationMs: run.finishedAt
          ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
          : null,
        status: run.status,
        triggeredBy: run.triggeredBy,
        output: run.output,
      }));

      res.json({ jobName: name, history });
    } catch (err) {
      logger.error({ err, jobName: name }, 'Error fetching job history');
      res.status(500).json({ error: 'Failed to fetch job history' });
    }
  },
);

// ---------------------------------------------------------------------------
// Source Management — RSS Sources
// ---------------------------------------------------------------------------

const rssSourceCreateSchema = z.object({
  name: z.string().min(2).max(100),
  url: z.string().url(),
  sport: z.enum(SPORTS as unknown as [string, ...string[]]),
  country: z.string().length(2).transform((s) => s.toUpperCase()),
});

const rssSourceUpdateSchema = z.object({
  active: z.boolean().optional(),
  name: z.string().min(2).max(100).optional(),
  sport: z.enum(SPORTS as unknown as [string, ...string[]]).optional(),
  country: z.string().length(2).transform((s) => s.toUpperCase()).optional(),
});

const videoSourceCreateSchema = z.object({
  name: z.string().min(2).max(100),
  feedUrl: z.string().url().refine((u) => u.includes('youtube.com'), { message: 'feedUrl must be a YouTube URL' }),
  sport: z.enum(SPORTS as unknown as [string, ...string[]]),
  platform: z.enum(['youtube_channel', 'youtube_playlist']),
});

const videoSourceUpdateSchema = z.object({
  active: z.boolean().optional(),
  name: z.string().min(2).max(100).optional(),
  sport: z.enum(SPORTS as unknown as [string, ...string[]]).optional(),
});

const RSS_STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const VIDEO_STALE_THRESHOLD_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * GET /api/admin/sources/rss
 * Returns paginated RSS sources with newsCount and isStale.
 */
router.get(
  '/sources/rss',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const sport = req.query.sport as string | undefined;
      const country = req.query.country as string | undefined;
      const activeParam = req.query.active as string | undefined;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
      const offset = (page - 1) * limit;

      const where: Prisma.RssSourceWhereInput = {};
      if (sport) where.sport = sport;
      if (country) where.country = country;
      if (activeParam === 'true') where.active = true;
      else if (activeParam === 'false') where.active = false;

      const [sources, total] = await Promise.all([
        prisma.rssSource.findMany({ where, skip: offset, take: limit, orderBy: { name: 'asc' } }),
        prisma.rssSource.count({ where }),
      ]);

      const now = Date.now();
      // N+1: one newsItem.count() per source. Acceptable at current scale (max 100 sources per page)
      // since NewsItem has no rssSourceId FK. Long-term fix: add rssSourceId FK and use Prisma _count.
      const enriched = await Promise.all(
        sources.map(async (src) => {
          // NOTE: NewsItem has no rssSourceId FK — match by source name (plain string).
          // Count may drift if source names change or two sources share a name variant.
          const newsCount = await prisma.newsItem.count({ where: { source: src.name } });
          const isStale = !src.lastSyncedAt || (now - new Date(src.lastSyncedAt).getTime()) > RSS_STALE_THRESHOLD_MS;
          return { ...src, newsCount, isStale };
        }),
      );

      const totalPages = Math.max(1, Math.ceil(total / limit));
      res.json({ sources: enriched, total, page, totalPages });
    } catch (err) {
      logger.error({ err }, 'Error fetching RSS sources');
      res.status(500).json({ error: 'Failed to fetch RSS sources' });
    }
  },
);

/**
 * PATCH /api/admin/sources/rss/:id
 * Partial update: active, name, sport, country.
 */
router.patch(
  '/sources/rss/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsed = rssSourceUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }

    try {
      const updated = await prisma.rssSource.update({
        where: { id },
        data: parsed.data,
      });
      res.json(updated);
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        res.status(404).json({ error: 'Source not found' });
        return;
      }
      logger.error({ err, id }, 'Error updating RSS source');
      res.status(500).json({ error: 'Failed to update RSS source' });
    }
  },
);

/**
 * DELETE /api/admin/sources/rss/:id
 * Only deletes custom sources; returns 403 for predefined.
 */
router.delete(
  '/sources/rss/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const source = await prisma.rssSource.findUnique({ where: { id } });
      if (!source) {
        res.status(404).json({ error: 'Source not found' });
        return;
      }
      if (!source.isCustom) {
        res.status(403).json({ error: 'Cannot delete predefined RSS sources' });
        return;
      }

      await prisma.rssSource.delete({ where: { id } });
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err, id }, 'Error deleting RSS source');
      res.status(500).json({ error: 'Failed to delete RSS source' });
    }
  },
);

/**
 * POST /api/admin/sources/rss/:id/sync
 * Trigger a single RSS source sync. Returns { processed, errors }.
 */
router.post(
  '/sources/rss/:id/sync',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const result = await syncSingleSource(id);
      res.json(result);
    } catch (err) {
      logger.error({ err, id }, 'Error syncing RSS source');
      res.status(500).json({ error: 'Failed to sync RSS source' });
    }
  },
);

/**
 * POST /api/admin/sources/rss
 * Add a custom RSS source. Validates feed reachability with rss-parser.
 */
router.post(
  '/sources/rss',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const parsed = rssSourceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }

    const { name, url, sport, country } = parsed.data;

    // Validate feed reachability
    const rssParser = new AdminRssParser({ timeout: 5000 });
    try {
      await rssParser.parseURL(url);
    } catch {
      res.status(422).json({ error: 'RSS feed is not reachable or invalid' });
      return;
    }

    try {
      const adminUserId = req.auth?.userId ?? 'unknown';
      const source = await prisma.rssSource.create({
        data: {
          name,
          url,
          sport,
          country,
          isCustom: true,
          addedBy: adminUserId,
          active: true,
        },
      });
      res.status(201).json(source);
    } catch (err) {
      logger.error({ err }, 'Error creating RSS source');
      res.status(500).json({ error: 'Failed to create RSS source' });
    }
  },
);

// ---------------------------------------------------------------------------
// Source Management — Video Sources
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/sources/video
 * Returns paginated VideoSource list with reelCount and isStale (>8h).
 */
router.get(
  '/sources/video',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const sport = req.query.sport as string | undefined;
      const activeParam = req.query.active as string | undefined;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
      const offset = (page - 1) * limit;

      const where: Prisma.VideoSourceWhereInput = {};
      if (sport) where.sport = sport;
      if (activeParam === 'true') where.active = true;
      else if (activeParam === 'false') where.active = false;

      const [sources, total] = await Promise.all([
        prisma.videoSource.findMany({ where, skip: offset, take: limit, orderBy: { name: 'asc' } }),
        prisma.videoSource.count({ where }),
      ]);

      const now = Date.now();
      // N+1: one reel.count() per source. Acceptable at current scale (max 100 sources per page).
      // VideoSource does have a videoSourceId FK on Reel, so a long-term fix with Prisma _count is feasible.
      const enriched = await Promise.all(
        sources.map(async (src) => {
          const reelCount = await prisma.reel.count({ where: { videoSourceId: src.id } });
          const isStale = !src.lastSyncedAt || (now - new Date(src.lastSyncedAt).getTime()) > VIDEO_STALE_THRESHOLD_MS;
          return { ...src, reelCount, isStale };
        }),
      );

      const totalPages = Math.max(1, Math.ceil(total / limit));
      res.json({ sources: enriched, total, page, totalPages });
    } catch (err) {
      logger.error({ err }, 'Error fetching video sources');
      res.status(500).json({ error: 'Failed to fetch video sources' });
    }
  },
);

/**
 * PATCH /api/admin/sources/video/:id
 * Partial update: active, name, sport.
 */
router.patch(
  '/sources/video/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsed = videoSourceUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }

    try {
      const updated = await prisma.videoSource.update({
        where: { id },
        data: parsed.data,
      });
      res.json(updated);
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        res.status(404).json({ error: 'Source not found' });
        return;
      }
      logger.error({ err, id }, 'Error updating video source');
      res.status(500).json({ error: 'Failed to update video source' });
    }
  },
);

/**
 * DELETE /api/admin/sources/video/:id
 * Only deletes custom sources; returns 403 for predefined.
 */
router.delete(
  '/sources/video/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const source = await prisma.videoSource.findUnique({ where: { id } });
      if (!source) {
        res.status(404).json({ error: 'Source not found' });
        return;
      }
      if (!source.isCustom) {
        res.status(403).json({ error: 'Cannot delete predefined video sources' });
        return;
      }

      await prisma.videoSource.delete({ where: { id } });
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err, id }, 'Error deleting video source');
      res.status(500).json({ error: 'Failed to delete video source' });
    }
  },
);

/**
 * POST /api/admin/sources/video/:id/sync
 * Trigger a single video source sync. Returns { processed, errors }.
 */
router.post(
  '/sources/video/:id/sync',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const result = await syncSingleVideoSource(id);
      res.json(result);
    } catch (err) {
      logger.error({ err, id }, 'Error syncing video source');
      res.status(500).json({ error: 'Failed to sync video source' });
    }
  },
);

/**
 * POST /api/admin/sources/video
 * Add a custom video source. Validates feedUrl contains youtube.com.
 */
router.post(
  '/sources/video',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const parsed = videoSourceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }

    const { name, feedUrl, sport, platform } = parsed.data;

    try {
      const adminUserId = req.auth?.userId ?? 'unknown';
      const source = await prisma.videoSource.create({
        data: {
          name,
          feedUrl,
          sport,
          platform,
          isCustom: true,
          addedBy: adminUserId,
          active: true,
        },
      });
      res.status(201).json(source);
    } catch (err) {
      logger.error({ err }, 'Error creating video source');
      res.status(500).json({ error: 'Failed to create video source' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/snapshot
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/analytics/snapshot?from=&to=&metrics=
 *
 * Returns analytics snapshots in a date range.
 * - from: ISO date (default 30 days ago)
 * - to: ISO date (default yesterday)
 * - metrics: comma-separated list (default all)
 *
 * Requires admin role.
 */
router.get(
  '/analytics/snapshot',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 59, 999);

      const thirtyDaysAgo = new Date(yesterday);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const fromParam = req.query.from as string | undefined;
      const toParam = req.query.to as string | undefined;
      const metricsParam = req.query.metrics as string | undefined;

      const from = fromParam ? new Date(fromParam) : thirtyDaysAgo;
      const to = toParam ? new Date(toParam) : yesterday;

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        res.status(400).json({ error: 'Invalid date parameters' });
        return;
      }

      const metricFilter = metricsParam
        ? metricsParam.split(',').map((m) => m.trim()).filter(Boolean)
        : undefined;

      const where: Prisma.AnalyticsSnapshotWhereInput = {
        date: { gte: from, lte: to },
      };

      if (metricFilter && metricFilter.length > 0) {
        where.metric = { in: metricFilter };
      }

      const snapshots = await prisma.analyticsSnapshot.findMany({
        where,
        orderBy: { date: 'asc' },
        select: { date: true, metric: true, value: true },
      });

      res.json({
        snapshots: snapshots.map((s) => ({
          date: s.date.toISOString(),
          metric: s.metric,
          value: s.value,
        })),
        from: from.toISOString(),
        to: to.toISOString(),
      });
    } catch (err) {
      logger.error({ err }, 'Error fetching analytics snapshots');
      res.status(500).json({ error: 'Failed to fetch analytics snapshots' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/top-content
// ---------------------------------------------------------------------------

type TopContentRow = {
  contentId: string;
  views: bigint;
  title: string | null;
  sport: string | null;
  publishedAt: Date | null;
};

/**
 * GET /api/admin/analytics/top-content?from=&to=&limit=
 *
 * Returns top viewed news items by activity log count.
 * - limit: default 10, max 50
 *
 * Requires admin role.
 */
router.get(
  '/analytics/top-content',
  requireAuth,
  requireRole('admin'),
  withCache('admin:top-content', 5 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 59, 999);

      const thirtyDaysAgo = new Date(yesterday);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const fromParam = req.query.from as string | undefined;
      const toParam = req.query.to as string | undefined;
      const limitParam = parseInt(String(req.query.limit ?? '10'), 10);
      const limit = Math.min(Math.max(1, isNaN(limitParam) ? 10 : limitParam), 50);

      const from = fromParam ? new Date(fromParam) : thirtyDaysAgo;
      const to = toParam ? new Date(toParam) : yesterday;

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        res.status(400).json({ error: 'Invalid date parameters' });
        return;
      }

      const rows = await prisma.$queryRaw<TopContentRow[]>`
        SELECT al."contentId", COUNT(*) as views, ni.title, ni.sport, ni."publishedAt"
        FROM "ActivityLog" al
        LEFT JOIN "NewsItem" ni ON ni.id = al."contentId"
        WHERE al.type = 'news_viewed'
          AND al."createdAt" >= ${from}
          AND al."createdAt" <= ${to}
          AND al."contentId" IS NOT NULL
        GROUP BY al."contentId", ni.title, ni.sport, ni."publishedAt"
        ORDER BY views DESC
        LIMIT ${limit}
      `;

      const items = rows.map((row) => ({
        contentId: row.contentId,
        title: row.title ?? null,
        sport: row.sport ?? null,
        publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
        views: Number(row.views),
      }));

      res.json({ items });
    } catch (err) {
      logger.error({ err }, 'Error fetching top content');
      res.status(500).json({ error: 'Failed to fetch top content' });
    }
  },
);

// ---------------------------------------------------------------------------
// Users & Organizations (prd6)
// ---------------------------------------------------------------------------

const userTierSchema = z.object({
  tier: z.enum(['free', 'premium']),
});

const userRoleSchema = z.object({
  role: z.enum(['child', 'parent', 'admin']),
});

const orgPatchSchema = z.object({
  active: z.boolean().optional(),
  maxMembers: z.number().int().positive().optional(),
});

/**
 * GET /api/admin/users?q=&role=&tier=&page=&limit=
 *
 * Lists users with optional search and filters.
 * Requires admin role.
 */
router.get(
  '/users',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string | undefined)?.trim();
      const role = req.query.role as string | undefined;
      const tier = req.query.tier as string | undefined;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25));
      const skip = (page - 1) * limit;

      const where: Prisma.UserWhereInput = {};

      if (q) {
        where.OR = [
          { email: { contains: q, mode: 'insensitive' } },
          { id: q },
        ];
      }
      if (role) {
        where.role = role;
      }
      if (tier) {
        where.subscriptionTier = tier;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            role: true,
            subscriptionTier: true,
            authProvider: true,
            country: true,
            locale: true,
            createdAt: true,
            lastLoginAt: true,
            organizationId: true,
            organizationRole: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        users,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      logger.error({ err }, 'Error listing admin users');
      res.status(500).json({ error: 'Failed to list users' });
    }
  },
);

/**
 * GET /api/admin/users/:id
 *
 * Returns full user profile with recent activity and stats.
 * Requires admin role.
 */
router.get(
  '/users/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const rawUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          age: true,
          email: true,
          authProvider: true,
          socialId: true,
          role: true,
          parentUserId: true,
          lastLoginAt: true,
          favoriteSports: true,
          favoriteTeam: true,
          selectedFeeds: true,
          pushEnabled: true,
          pushPreferences: true,
          totalPoints: true,
          currentStreak: true,
          longestStreak: true,
          lastActiveDate: true,
          currentQuizCorrectStreak: true,
          quizPerfectCount: true,
          createdAt: true,
          updatedAt: true,
          locale: true,
          country: true,
          ageGateCompleted: true,
          consentGiven: true,
          consentDate: true,
          consentBy: true,
          subscriptionTier: true,
          subscriptionExpiry: true,
          organizationId: true,
          organizationRole: true,
          parentalProfile: {
            select: {
              allowedSports: true,
              allowedFormats: true,
              maxNewsMinutes: true,
              allowedHoursStart: true,
              allowedHoursEnd: true,
              pin: true,
            },
          },
        },
      });

      if (!rawUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const { parentalProfile, ...userFields } = rawUser;

      const [recentActivity, stickerCount, achievementCount, totalQuizAnswers, totalNewsViewed] =
        await Promise.all([
          prisma.activityLog.findMany({
            where: { userId: id },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              type: true,
              sport: true,
              contentId: true,
              durationSeconds: true,
              createdAt: true,
            },
          }),
          prisma.userSticker.count({ where: { userId: id } }),
          prisma.userAchievement.count({ where: { userId: id } }),
          prisma.userQuizHistory.count({ where: { userId: id } }),
          prisma.activityLog.count({ where: { userId: id, type: 'news_viewed' } }),
        ]);

      res.json({
        ...userFields,
        parentalProfile: parentalProfile
          ? {
              hasPin: !!parentalProfile.pin,
              allowedSports: parentalProfile.allowedSports,
              allowedFormats: parentalProfile.allowedFormats,
              maxNewsMinutes: parentalProfile.maxNewsMinutes,
              // scheduleLocked = true when schedule is restricted (not full-day 0-24)
              scheduleLocked: parentalProfile.allowedHoursStart !== 0 || parentalProfile.allowedHoursEnd !== 24,
            }
          : null,
        recentActivity,
        stats: {
          stickerCount,
          achievementCount,
          totalQuizAnswers,
          totalNewsViewed,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Error fetching admin user detail');
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  },
);

/**
 * PATCH /api/admin/users/:id/tier
 *
 * Changes user subscription tier.
 * Requires admin role.
 */
router.patch(
  '/users/:id/tier',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const parsed = userTierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid tier' });
      return;
    }

    try {
      const { id } = req.params;
      const user = await prisma.user.update({
        where: { id },
        data: { subscriptionTier: parsed.data.tier },
        select: { id: true, subscriptionTier: true },
      });
      res.json(user);
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      logger.error({ err }, 'Error updating user tier');
      res.status(500).json({ error: 'Failed to update tier' });
    }
  },
);

/**
 * PATCH /api/admin/users/:id/role
 *
 * Changes user role. Cannot change own role.
 * Requires admin role.
 */
router.patch(
  '/users/:id/role',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const parsed = userRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid role' });
      return;
    }

    const { id } = req.params;
    const adminUserId = req.auth?.userId;

    if (adminUserId === id) {
      res.status(403).json({ error: 'Cannot change your own role' });
      return;
    }

    try {
      const user = await prisma.user.update({
        where: { id },
        data: { role: parsed.data.role },
        select: { id: true, role: true },
      });
      res.json(user);
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      logger.error({ err }, 'Error updating user role');
      res.status(500).json({ error: 'Failed to update role' });
    }
  },
);

/**
 * POST /api/admin/users/:id/revoke-tokens
 *
 * Deletes all RefreshToken records for the user.
 * Requires admin role.
 */
router.post(
  '/users/:id/revoke-tokens',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await prisma.refreshToken.deleteMany({ where: { userId: id } });
      res.json({ revoked: result.count });
    } catch (err) {
      logger.error({ err }, 'Error revoking user tokens');
      res.status(500).json({ error: 'Failed to revoke tokens' });
    }
  },
);

/**
 * GET /api/admin/organizations?sport=&active=&page=&limit=
 *
 * Lists organizations with optional filters.
 * Requires admin role.
 */
router.get(
  '/organizations',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const sport = req.query.sport as string | undefined;
      const activeParam = req.query.active as string | undefined;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25));
      const skip = (page - 1) * limit;

      const where: Prisma.OrganizationWhereInput = {};
      if (sport) where.sport = sport;
      if (activeParam !== undefined) {
        where.active = activeParam === 'true';
      }

      const [orgs, total] = await Promise.all([
        prisma.organization.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            slug: true,
            sport: true,
            logoUrl: true,
            inviteCode: true,
            maxMembers: true,
            active: true,
            createdAt: true,
            createdBy: true,
            _count: {
              select: { members: true },
            },
          },
        }),
        prisma.organization.count({ where }),
      ]);

      res.json({
        organizations: orgs.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          sport: org.sport,
          logoUrl: org.logoUrl,
          inviteCode: org.inviteCode,
          maxMembers: org.maxMembers,
          memberCount: org._count.members,
          active: org.active,
          createdAt: org.createdAt,
          createdBy: org.createdBy,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      logger.error({ err }, 'Error listing admin organizations');
      res.status(500).json({ error: 'Failed to list organizations' });
    }
  },
);

type OrgActivityRow = {
  date: Date;
  count: bigint;
};

/**
 * GET /api/admin/organizations/:id
 *
 * Returns full organization detail with members and activity summary.
 * Requires admin role.
 */
router.get(
  '/organizations/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id: orgId } = req.params;

      type OrgWithMembers = Prisma.OrganizationGetPayload<{
        include: {
          members: {
            select: {
              id: true;
              email: true;
              role: true;
              organizationRole: true;
              subscriptionTier: true;
              lastLoginAt: true;
              createdAt: true;
            };
          };
        };
      }>;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          members: {
            select: {
              id: true,
              email: true,
              role: true,
              organizationRole: true,
              subscriptionTier: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
        },
      }) as OrgWithMembers | null;

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const activityRows = await prisma.$queryRaw<OrgActivityRow[]>`
        SELECT DATE_TRUNC('day', al."createdAt") AS date, COUNT(*) AS count
        FROM "ActivityLog" al
        JOIN "User" u ON u.id = al."userId"
        WHERE u."organizationId" = ${orgId}
          AND al."createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', al."createdAt")
        ORDER BY date ASC
      `;

      const dailyActivity = activityRows.map((row) => ({
        date: new Date(row.date).toISOString().split('T')[0]!,
        count: Number(row.count),
      }));

      const totalViews = dailyActivity.reduce((sum, r) => sum + r.count, 0);

      const { members, ...orgFields } = org;

      res.json({
        organization: orgFields,
        members: members.map((m) => ({
          id: m.id,
          email: m.email,
          role: m.role,
          orgRole: m.organizationRole,
          subscriptionTier: m.subscriptionTier,
          lastLoginAt: m.lastLoginAt,
          joinedAt: m.createdAt,
        })),
        memberCount: members.length,
        activitySummary: {
          dailyActivity,
          totalViews,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Error fetching admin organization detail');
      res.status(500).json({ error: 'Failed to fetch organization' });
    }
  },
);

/**
 * PATCH /api/admin/organizations/:id
 *
 * Updates organization active status or maxMembers.
 * maxMembers must be >= current member count.
 * Requires admin role.
 */
router.patch(
  '/organizations/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const parsed = orgPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
      return;
    }

    const { id: orgId } = req.params;
    const { active, maxMembers } = parsed.data;

    try {
      if (maxMembers !== undefined) {
        const memberCount = await prisma.user.count({ where: { organizationId: orgId } });
        if (maxMembers < memberCount) {
          res.status(400).json({
            error: `maxMembers (${maxMembers}) cannot be less than current member count (${memberCount})`,
          });
          return;
        }
      }

      const org = await prisma.organization.update({
        where: { id: orgId },
        data: {
          ...(active !== undefined && { active }),
          ...(maxMembers !== undefined && { maxMembers }),
        },
        select: { id: true, active: true, maxMembers: true },
      });

      res.json(org);
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      logger.error({ err }, 'Error updating organization');
      res.status(500).json({ error: 'Failed to update organization' });
    }
  },
);

/**
 * POST /api/admin/organizations/:id/regenerate-code
 *
 * Generates a new 6-char alphanumeric invite code for the organization.
 * Secured with requireRole('admin') — no org membership required.
 */
router.post(
  '/organizations/:id/regenerate-code',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const inviteCode = await generateUniqueCode();

      await prisma.organization.update({
        where: { id },
        data: { inviteCode },
      });

      logger.info({ orgId: id }, 'Admin regenerated invite code');

      res.json({ inviteCode });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      logger.error({ err }, 'Error regenerating invite code');
      res.status(500).json({ error: 'Failed to regenerate invite code' });
    }
  },
);

export default router;
