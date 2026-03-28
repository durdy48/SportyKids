import cron from 'node-cron';
import { syncAllSources, SyncAllResult } from '../services/aggregator';
import { startDailyQuizJob } from './generate-daily-quiz';
import { prisma } from '../config/database';
import { sendPushToUsers } from '../services/push-sender';
import { t } from '@sportykids/shared';
import { logger } from '../services/logger';

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

// Run synchronization every 30 minutes
export function startSyncJob(): void {
  if (activeJob) {
    logger.info('Sync job is already active.');
    return;
  }

  activeJob = cron.schedule('*/30 * * * *', async () => {
    logger.info('Running scheduled synchronization...');
    const syncStart = new Date();
    await syncAllSources();
    await notifyTeamNews(syncStart);
  });

  logger.info('Sync job scheduled: every 30 minutes.');

  // Start daily quiz generation job
  startDailyQuizJob();
}

// Manual synchronization (on startup or from admin route)
export async function runManualSync(): Promise<SyncAllResult> {
  logger.info('Running manual synchronization...');
  return syncAllSources();
}
