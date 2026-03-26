import cron from 'node-cron';
import { prisma } from '../config/database';
import { sendPushToUser } from '../services/push-sender';
import { t } from '@sportykids/shared';

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
      console.error(`[StreakReminder] Error sending to user ${user.id}:`, error);
    }
  }

  console.log(`[StreakReminder] Sent ${result.sent} reminders.`);
  return result;
}

// ---------------------------------------------------------------------------
// Cron job: daily at 20:00 UTC
// ---------------------------------------------------------------------------

let activeJob: ReturnType<typeof cron.schedule> | null = null;

export function startStreakReminderJob(): void {
  if (activeJob) {
    console.log('[StreakReminder] Job is already active.');
    return;
  }

  activeJob = cron.schedule('0 20 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running streak reminders...`);
    await sendStreakReminders();
  });

  console.log('[StreakReminder] Job scheduled: daily at 20:00 UTC.');
}
