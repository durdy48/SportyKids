import cron from 'node-cron';
import { syncAllSources, SyncAllResult } from '../services/aggregator';
import { startDailyQuizJob } from './generate-daily-quiz';
import { prisma } from '../config/database';
import { sendPushToUsers } from '../services/push-sender';
import { t } from '@sportykids/shared';
import { logger } from '../services/logger';

/** Threshold in minutes for warning about stale pending content (PRD: 30min). */
const STALE_PENDING_THRESHOLD_MINUTES = 30;

let activeJob: cron.ScheduledTask | null = null;

/**
 * After sync, send push notifications for new team-specific articles.
 * Exported for testing.
 */
export async function notifyTeamNews(syncStartTime: Date): Promise<void> {
  try {
    const newTeamArticles = await prisma.newsItem.findMany({
      where: {
        createdAt: { gte: syncStartTime },
        team: { not: null },
        safetyStatus: 'approved',
      },
      select: { id: true, title: true, team: true },
    });

    if (newTeamArticles.length === 0) return;

    // Group by team
    const byTeam = new Map<string, string>();
    for (const article of newTeamArticles) {
      if (article.team && !byTeam.has(article.team)) {
        byTeam.set(article.team, article.title);
      }
    }

    for (const [team, title] of byTeam) {
      const users = await prisma.user.findMany({
        where: { favoriteTeam: team, pushEnabled: true },
        select: { id: true, locale: true },
      });

      if (users.length > 0) {
        // Group users by locale for per-locale push messages
        const byLocale = new Map<string, string[]>();
        for (const u of users) {
          const loc = u.locale || 'es';
          if (!byLocale.has(loc)) byLocale.set(loc, []);
          byLocale.get(loc)!.push(u.id);
        }

        for (const [locale, userIds] of byLocale) {
          await sendPushToUsers(
            userIds,
            {
              title: t('push.team_news_title', locale).replace('{team}', team),
              body: title,
              data: { screen: 'HomeFeed' },
            },
            'teamUpdates',
          );
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error sending team news push');
  }
}

export async function runSyncFeeds(triggeredBy: 'cron' | 'manual' = 'cron', triggeredId?: string, existingRunId?: string): Promise<void> {
  // Skip if another instance is already running (prevents duplicate runs from overlapping processes)
  if (!existingRunId) {
    const alreadyRunning = await prisma.jobRun.findFirst({
      where: { jobName: 'sync-feeds', status: 'running' },
    });
    if (alreadyRunning) {
      logger.info({ existingRunId: alreadyRunning.id }, 'sync-feeds already running — skipping duplicate execution');
      return;
    }
  }

  const run = existingRunId
    ? { id: existingRunId }
    : await prisma.jobRun.create({
        data: { jobName: 'sync-feeds', status: 'running', triggeredBy, triggeredId },
      });
  try {
    const syncStart = new Date();
    const result = await syncAllSources();
    await notifyTeamNews(syncStart);
    await checkStalePendingContent();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        output: { processed: result.totalProcessed ?? 0, errors: result.totalErrors ?? 0 },
      },
    });
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'error', finishedAt: new Date(), output: { error: String(e) } },
    });
    throw e;
  }
}

// Run synchronization every 30 minutes
export function startSyncJob(): void {
  if (activeJob) {
    logger.info('Sync job is already active.');
    return;
  }

  activeJob = cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled synchronization...');
    await runSyncFeeds('cron');
  });

  logger.info('Sync job scheduled: every 60 minutes.');

  // Start daily quiz generation job
  startDailyQuizJob();
}

/**
 * Check for stale pending content and emit a warning.
 * Exported for testing.
 */
export async function checkStalePendingContent(): Promise<void> {
  try {
    const threshold = new Date(Date.now() - STALE_PENDING_THRESHOLD_MINUTES * 60_000);
    const stalePendingCount = await prisma.newsItem.count({
      where: {
        safetyStatus: 'pending',
        createdAt: { lte: threshold },
      },
    });

    if (stalePendingCount > 0) {
      logger.warn(
        { stalePendingCount, thresholdMinutes: STALE_PENDING_THRESHOLD_MINUTES },
        `${stalePendingCount} news items have been in pending moderation status for over ${STALE_PENDING_THRESHOLD_MINUTES}min. Review via GET /api/admin/moderation/pending.`,
      );
    }
  } catch (err) {
    logger.error({ err }, 'Error checking stale pending content');
  }
}

// Manual synchronization (on startup or from admin route)
export async function runManualSync(): Promise<SyncAllResult> {
  logger.info('Running manual synchronization...');
  return syncAllSources();
}
