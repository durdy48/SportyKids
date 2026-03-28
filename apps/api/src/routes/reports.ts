import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { checkMissionProgress } from '../services/mission-generator';
import { verifyParentalSession } from '../services/parental-session';
import { ValidationError, NotFoundError, ConflictError, RateLimitError, AuthenticationError } from '../errors';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/reports — Submit a content report
// ---------------------------------------------------------------------------
const reportSchema = z.object({
  userId: z.string(),
  contentType: z.enum(['news', 'reel']),
  contentId: z.string(),
  reason: z.enum(['inappropriate', 'scary', 'confusing', 'other']),
  comment: z.string().max(200).optional(),
});

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

router.post('/', async (req: Request, res: Response) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const { userId, contentType, contentId, reason, comment } = parsed.data;

  // Rate limit: max 10 reports per user in 24h
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentCount = await prisma.contentReport.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });

  if (recentCount >= RATE_LIMIT_MAX) {
    throw new RateLimitError('rate_limit_exceeded');
  }

  // Duplicate check: same user + contentType + contentId
  const existing = await prisma.contentReport.findFirst({
    where: { userId, contentType, contentId },
  });

  if (existing) {
    throw new ConflictError('already_reported');
  }

  const report = await prisma.contentReport.create({
    data: {
      userId,
      contentType,
      contentId,
      reason,
      comment,
      status: 'pending',
    },
  });

  // Check daily mission progress for report submission
  await checkMissionProgress(userId, 'report_submitted');

  res.status(201).json(report);
});

// ---------------------------------------------------------------------------
// GET /api/reports/parent/:userId — Get reports from a child (parental review)
// ---------------------------------------------------------------------------
router.get('/parent/:userId', async (req: Request, res: Response) => {
  const reports = await prisma.contentReport.findMany({
    where: { userId: req.params.userId },
    orderBy: { createdAt: 'desc' },
  });

  // Collect content IDs by type for batch title lookup
  const newsIds = reports
    .filter((r) => r.contentType === 'news')
    .map((r) => r.contentId);
  const reelIds = reports
    .filter((r) => r.contentType === 'reel')
    .map((r) => r.contentId);

  // Fetch titles in parallel
  const [newsItems, reels] = await Promise.all([
    newsIds.length > 0
      ? prisma.newsItem.findMany({
          where: { id: { in: newsIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    reelIds.length > 0
      ? prisma.reel.findMany({
          where: { id: { in: reelIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  // Build title lookup maps
  const titleMap = new Map<string, string>();
  for (const item of newsItems) {
    titleMap.set(item.id, item.title);
  }
  for (const reel of reels) {
    titleMap.set(reel.id, reel.title);
  }

  // Merge titles into response
  const result = reports.map((r) => ({
    id: r.id,
    contentType: r.contentType,
    contentId: r.contentId,
    contentTitle: titleMap.get(r.contentId) ?? null,
    reason: r.reason,
    comment: r.comment,
    status: r.status,
    reviewedAt: r.reviewedAt,
    createdAt: r.createdAt,
  }));

  res.json(result);
});

// ---------------------------------------------------------------------------
// PUT /api/reports/:reportId — Update report status
// ---------------------------------------------------------------------------
const updateReportSchema = z.object({
  status: z.enum(['reviewed', 'dismissed', 'actioned']),
});

router.put('/:reportId', async (req: Request, res: Response) => {
  const sessionUserId = await verifyParentalSession(req.headers['x-parental-session'] as string | undefined);
  if (!sessionUserId) {
    throw new AuthenticationError('Parental session required');
  }

  const parsed = updateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid data', parsed.error.flatten());
  }

  const report = await prisma.contentReport.findUnique({
    where: { id: req.params.reportId },
  });

  if (!report) {
    throw new NotFoundError('Report not found');
  }

  const updated = await prisma.contentReport.update({
    where: { id: req.params.reportId },
    data: {
      status: parsed.data.status,
      reviewedAt: new Date(),
    },
  });

  res.json(updated);
});

export default router;
