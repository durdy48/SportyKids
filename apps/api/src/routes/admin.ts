import { Router, type Request, type Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';
import { logger } from '../services/logger';
import { generateDailyQuiz } from '../jobs/generate-daily-quiz';

const router = Router();

/** Maximum items returned per request (PRD spec). */
const PENDING_LIMIT = 100;

/**
 * GET /api/admin/moderation/pending
 *
 * Returns a flat list of pending news items and reels ordered by createdAt ASC
 * (oldest first). Each item includes a `summary` (first 200 chars of content),
 * `pendingMinutes`, and the response includes `oldestPendingMinutes`.
 *
 * Requires admin role.
 */
router.get(
  '/moderation/pending',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const now = Date.now();

      const [newsItems, reelItems] = await Promise.all([
        prisma.newsItem.findMany({
          where: { safetyStatus: 'pending' },
          select: {
            id: true,
            title: true,
            summary: true,
            source: true,
            sport: true,
            safetyReason: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
          take: PENDING_LIMIT,
        }),
        prisma.reel.findMany({
          where: { safetyStatus: 'pending' },
          select: {
            id: true,
            title: true,
            sport: true,
            safetyReason: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
          take: PENDING_LIMIT,
        }),
      ]);

      // Build flat pending array with type discriminator
      const pending = [
        ...newsItems.map((n) => ({
          id: n.id,
          type: 'news' as const,
          title: n.title,
          summary: (n.summary ?? '').slice(0, 200),
          source: n.source,
          sport: n.sport,
          safetyReason: n.safetyReason,
          createdAt: n.createdAt,
          pendingMinutes: Math.round((now - new Date(n.createdAt).getTime()) / 60_000),
        })),
        ...reelItems.map((r) => ({
          id: r.id,
          type: 'reel' as const,
          title: r.title,
          summary: '',
          source: null,
          sport: r.sport,
          safetyReason: r.safetyReason,
          createdAt: r.createdAt,
          pendingMinutes: Math.round((now - new Date(r.createdAt).getTime()) / 60_000),
        })),
      ];

      // Sort combined list by createdAt ASC (oldest first) and limit to 100
      pending.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const limited = pending.slice(0, PENDING_LIMIT);

      const oldestPendingMinutes =
        limited.length > 0 ? limited[0].pendingMinutes : 0;

      res.json({
        pending: limited,
        total: pending.length,
        oldestPendingMinutes,
      });
    } catch (err) {
      logger.error({ err }, 'Error fetching pending moderation items');
      res.status(500).json({ error: 'Failed to fetch pending items' });
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
    const result = await generateDailyQuiz();
    res.json({ ok: true, generated: result.generated, errors: result.errors });
  },
);

export default router;
