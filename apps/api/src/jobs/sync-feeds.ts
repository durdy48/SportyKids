import cron from 'node-cron';
import { syncAllSources, SyncAllResult } from '../services/aggregator';
import { startDailyQuizJob } from './generate-daily-quiz';
import { prisma } from '../config/database';
import { sendPushToUsers } from '../services/push-sender';
import { t } from '@sportykids/shared';

let activeJob: cron.ScheduledTask | null = null;

/**
 * After sync, send push notifications for new team-specific articles.
 */
async function notifyTeamNews(syncStartTime: Date): Promise<void> {
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
        select: { id: true },
      });

      if (users.length > 0) {
        await sendPushToUsers(
          users.map((u) => u.id),
          {
            // TODO: group by user locale for per-locale messages in production
            title: t('push.team_news_title', 'es').replace('{team}', team),
            body: title,
            data: { screen: 'HomeFeed' },
          },
          'teamUpdates',
        );
      }
    }
  } catch (err) {
    console.error('[SyncFeeds] Error sending team news push:', err);
  }
}

// Run synchronization every 30 minutes
export function startSyncJob(): void {
  if (activeJob) {
    console.log('Sync job is already active.');
    return;
  }

  activeJob = cron.schedule('*/30 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled synchronization...`);
    const syncStart = new Date();
    await syncAllSources();
    await notifyTeamNews(syncStart);
  });

  console.log('Sync job scheduled: every 30 minutes.');

  // Start daily quiz generation job
  startDailyQuizJob();
}

// Manual synchronization (on startup or from admin route)
export async function runManualSync(): Promise<SyncAllResult> {
  console.log(`[${new Date().toISOString()}] Running manual synchronization...`);
  return syncAllSources();
}
