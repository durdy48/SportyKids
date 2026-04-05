import cron from 'node-cron';
import { prisma } from '../config/database';
import { generateDailyMission } from '../services/mission-generator';
import { logger } from '../services/logger';

// ---------------------------------------------------------------------------
// Pre-generate daily missions for active users
// ---------------------------------------------------------------------------

export async function generateDailyMissions(): Promise<{ generated: number; errors: number }> {
  const result = { generated: 0, errors: 0 };

  // Find users active in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const activeUsers = await prisma.user.findMany({
    where: {
      lastActiveDate: { gte: sevenDaysAgo },
    },
    select: { id: true, locale: true },
  });

  logger.info({ activeUsers: activeUsers.length }, 'Found active users for daily missions');

  const { sendPushToUser } = await import('../services/push-sender');
  const { t } = await import('@sportykids/shared');

  for (const user of activeUsers) {
    try {
      const mission = await generateDailyMission(user.id);
      result.generated++;

      // Send push notification about new mission
      if (mission) {
        const locale = user.locale || 'es';
        sendPushToUser(user.id, {
          title: t('push.mission_ready_title', locale),
          body: t('push.mission_ready_body', locale).replace('{rarity}', mission.rewardRarity || 'common'),
          data: { screen: 'HomeFeed' },
        }).catch(() => {}); // Non-blocking
      }
    } catch (err) {
      result.errors++;
      logger.error(
        { err: err instanceof Error ? err : new Error(String(err)), userId: user.id },
        'Error generating mission for user',
      );
    }
  }

  logger.info(
    { generated: result.generated, errors: result.errors },
    'Daily missions generation finished',
  );

  return result;
}

// ---------------------------------------------------------------------------
// Cron job: daily at 05:00 UTC
// ---------------------------------------------------------------------------

export async function runGenerateDailyMissions(triggeredBy: 'cron' | 'manual' = 'cron', triggeredId?: string, existingRunId?: string): Promise<void> {
  const run = existingRunId
    ? { id: existingRunId }
    : await prisma.jobRun.create({
        data: { jobName: 'generate-daily-missions', status: 'running', triggeredBy, triggeredId },
      });
  try {
    const result = await generateDailyMissions();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        output: { generated: result.generated, errors: result.errors },
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

let activeJob: ReturnType<typeof cron.schedule> | null = null;

export function startDailyMissionsJob(): void {
  if (activeJob) {
    logger.info('Daily missions job is already active.');
    return;
  }

  activeJob = cron.schedule('0 5 * * *', async () => {
    logger.info('Running daily missions generation...');
    await runGenerateDailyMissions('cron');
  });

  logger.info('Daily missions job scheduled: daily at 05:00 UTC.');
}
