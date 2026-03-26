import cron from 'node-cron';
import { prisma } from '../config/database';
import { generateDailyMission } from '../services/mission-generator';

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
    select: { id: true },
  });

  console.log(`[DailyMissions] Found ${activeUsers.length} active users.`);

  const { sendPushToUser } = await import('../services/push-sender');
  const { t } = await import('@sportykids/shared');

  for (const user of activeUsers) {
    try {
      const mission = await generateDailyMission(user.id);
      result.generated++;

      // Send push notification about new mission
      if (mission) {
        sendPushToUser(user.id, {
          // TODO: use user locale for per-locale messages in production
          title: t('push.mission_ready_title', 'es'),
          body: t('push.mission_ready_body', 'es').replace('{rarity}', mission.rewardRarity || 'common'),
          data: { screen: 'HomeFeed' },
        }).catch(() => {}); // Non-blocking
      }
    } catch (err) {
      result.errors++;
      console.error(
        `[DailyMissions] Error generating mission for user ${user.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[DailyMissions] Finished. Generated: ${result.generated}, Errors: ${result.errors}`,
  );

  return result;
}

// ---------------------------------------------------------------------------
// Cron job: daily at 05:00 UTC
// ---------------------------------------------------------------------------

let activeJob: ReturnType<typeof cron.schedule> | null = null;

export function startDailyMissionsJob(): void {
  if (activeJob) {
    console.log('[DailyMissions] Job is already active.');
    return;
  }

  activeJob = cron.schedule('0 5 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running daily missions generation...`);
    await generateDailyMissions();
  });

  console.log('[DailyMissions] Job scheduled: daily at 05:00 UTC.');
}
