import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../services/logger';
import { sendPushToUser } from '../services/push-sender';
import { t } from '@sportykids/shared';

// ---------------------------------------------------------------------------
// Send reminder push for users close to completing their daily mission
// ---------------------------------------------------------------------------

export async function sendMissionReminders(): Promise<{ sent: number; errors: number }> {
  const result = { sent: 0, errors: 0 };

  const today = new Date().toISOString().split('T')[0];

  // Find missions that are >50% progress and not yet completed
  const missions = await prisma.dailyMission.findMany({
    where: { date: today, completed: false },
  });

  // Fetch push-enabled users for those missions in a single query
  const userIds = [...new Set(missions.map((m) => m.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, pushEnabled: true },
    select: { id: true, locale: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  for (const mission of missions) {
    // Only remind if >50% progress
    if (mission.target <= 0 || mission.progress / mission.target <= 0.5) continue;

    const user = userMap.get(mission.userId);
    if (!user) continue; // push not enabled or user not found

    try {
      const locale = user.locale || 'es';
      await sendPushToUser(user.id, {
        title: t('push.mission_almost_title', locale),
        body: t('push.mission_almost_body', locale),
        data: { screen: 'HomeFeed' },
      });
      result.sent++;
    } catch (err) {
      result.errors++;
      logger.error(
        { err: err instanceof Error ? err : new Error(String(err)), userId: mission.userId },
        'Error sending mission reminder',
      );
    }
  }

  logger.info(
    { sent: result.sent, errors: result.errors },
    'Mission reminders finished',
  );

  return result;
}

// ---------------------------------------------------------------------------
// Cron job: daily at 18:00 UTC
// ---------------------------------------------------------------------------

export async function runMissionReminder(triggeredBy: 'cron' | 'manual' = 'cron', triggeredId?: string, existingRunId?: string): Promise<void> {
  const run = existingRunId
    ? { id: existingRunId }
    : await prisma.jobRun.create({
        data: { jobName: 'mission-reminder', status: 'running', triggeredBy, triggeredId },
      });
  try {
    const result = await sendMissionReminders();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        output: { sent: result.sent, errors: result.errors },
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

export function startMissionReminderJob(): void {
  if (activeJob) {
    logger.info('Mission reminder job is already active.');
    return;
  }

  activeJob = cron.schedule('0 18 * * *', async () => {
    logger.info('Running mission reminders...');
    await runMissionReminder('cron');
  });

  logger.info('Mission reminder job scheduled: daily at 18:00 UTC.');
}
