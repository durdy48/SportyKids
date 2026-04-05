import cron from 'node-cron';
import { prisma } from '../config/database';
import { sendPushToUser } from '../services/push-sender';
import { t } from '@sportykids/shared';
import { logger } from '../services/logger';

// ---------------------------------------------------------------------------
// Streak reminder: notify users at risk of losing their streak
// ---------------------------------------------------------------------------

export async function sendStreakReminders(): Promise<{ sent: number }> {
  const result = { sent: 0 };

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Find users with streak >= 3 who haven't checked in today (filter at DB level)
  const todayStart = new Date(todayStr + 'T00:00:00.000Z');
  const atRiskUsers = await prisma.user.findMany({
    where: {
      currentStreak: { gte: 3 },
      pushEnabled: true,
      lastActiveDate: { not: null, lt: todayStart },
    },
    select: { id: true, currentStreak: true, locale: true },
  });

  for (const user of atRiskUsers) {

    const locale = (user.locale === 'en' ? 'en' : 'es') as 'es' | 'en';

    try {
      await sendPushToUser(user.id, {
        title: t('push.streak_warning_title', locale),
        body: t('push.streak_warning_body', locale).replace('{days}', String(user.currentStreak)),
        data: { screen: 'HomeFeed' },
      });
      result.sent++;
    } catch (error) {
      logger.error({ err: error, userId: user.id }, 'Error sending streak reminder to user');
    }
  }

  logger.info({ sent: result.sent }, 'Streak reminders sent');
  return result;
}

// ---------------------------------------------------------------------------
// Cron job: daily at 20:00 UTC
// ---------------------------------------------------------------------------

export async function runStreakReminder(triggeredBy: 'cron' | 'manual' = 'cron', triggeredId?: string, existingRunId?: string): Promise<void> {
  const run = existingRunId
    ? { id: existingRunId }
    : await prisma.jobRun.create({
        data: { jobName: 'streak-reminder', status: 'running', triggeredBy, triggeredId },
      });
  try {
    const result = await sendStreakReminders();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        output: { sent: result.sent },
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

export function startStreakReminderJob(): void {
  if (activeJob) {
    logger.info('Streak reminder job is already active.');
    return;
  }

  activeJob = cron.schedule('0 20 * * *', async () => {
    logger.info('Running streak reminders...');
    await runStreakReminder('cron');
  });

  logger.info('Streak reminder job scheduled: daily at 20:00 UTC.');
}
