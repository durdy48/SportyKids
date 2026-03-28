import cron from 'node-cron';
import { prisma } from '../config/database';
import { generateDigestData, renderDigestHtml } from '../services/digest-generator';
import { t, type Locale } from '@sportykids/shared';
import { logger } from '../services/logger';

let activeJob: cron.ScheduledTask | null = null;

async function sendDigestEmail(to: string, subject: string, html: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'noreply@sportykids.app';

  if (!host || !port) {
    return false;
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({ from, to, subject, html });
    return true;
  } catch (err) {
    logger.error({ err, to }, 'Failed to send digest email');
    return false;
  }
}

async function processWeeklyDigests(): Promise<void> {
  const currentDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...

  const profiles = await prisma.parentalProfile.findMany({
    where: {
      digestEnabled: true,
      digestDay: currentDay,
    },
    include: { user: true },
  });

  logger.info({ count: profiles.length, day: currentDay }, 'Found digests to send');

  for (const profile of profiles) {
    try {
      const data = await generateDigestData(profile.userId);
      const locale = (profile.user?.locale as Locale) || 'es';

      if (profile.digestEmail) {
        const subject = t('digest.email_subject', locale, { name: data.userName });
        const html = renderDigestHtml(data, locale);
        const sent = await sendDigestEmail(profile.digestEmail, subject, html);

        if (sent) {
          logger.info({ email: profile.digestEmail, userId: profile.userId }, 'Digest email sent');
        } else {
          logger.info({ userId: profile.userId }, 'SMTP not configured, skipping digest email');
        }
      }

      // Update lastDigestSentAt regardless (digest was generated)
      await prisma.parentalProfile.update({
        where: { userId: profile.userId },
        data: { lastDigestSentAt: new Date() },
      });
    } catch (err) {
      logger.error({ err, userId: profile.userId }, 'Error processing weekly digest');
    }
  }
}

/** Start the weekly digest cron job — runs daily at 08:00 UTC */
export function startWeeklyDigestJob(): void {
  if (activeJob) {
    logger.info('Weekly digest job is already active.');
    return;
  }

  activeJob = cron.schedule('0 8 * * *', async () => {
    logger.info('Running weekly digest job...');
    await processWeeklyDigests();
  });

  logger.info('Weekly digest job scheduled: daily at 08:00 UTC.');
}

// Export for testing
export { processWeeklyDigests };
