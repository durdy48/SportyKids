import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { logger } from '../services/logger.js';
import {
  computeDau,
  computeMau,
  computeSportActivity,
  computeRetentionD1,
  computeRetentionD7,
  computeSubscriptionBreakdown,
  computeParentalActivationRate,
  computeConsentRate,
  computeQuizEngagement,
  computeMissionsCompleted,
  computeMissionsClaimed,
} from '../services/admin-stats.js';

let activeJob: cron.ScheduledTask | null = null;

export async function runComputeAnalytics(
  triggeredBy: 'cron' | 'manual' = 'cron',
  triggeredId?: string,
  existingRunId?: string,
): Promise<void> {
  const run = existingRunId
    ? { id: existingRunId }
    : await prisma.jobRun.create({
        data: { jobName: 'compute-analytics', status: 'running', triggeredBy, triggeredId },
      });

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const metrics = await Promise.all([
      computeDau(yesterday).then((v) => ({ metric: 'dau', value: v })),
      computeMau(yesterday).then((v) => ({ metric: 'mau', value: v })),
      computeSportActivity(yesterday).then((v) => ({ metric: 'sport_activity', value: v })),
      computeRetentionD1(yesterday).then((v) => ({ metric: 'retention_d1', value: v })),
      computeRetentionD7(yesterday).then((v) => ({ metric: 'retention_d7', value: v })),
      computeSubscriptionBreakdown().then((v) => ({ metric: 'subscription_breakdown', value: v })),
      computeParentalActivationRate().then((v) => ({ metric: 'parental_activation_rate', value: v })),
      computeConsentRate().then((v) => ({ metric: 'consent_rate', value: v })),
      computeQuizEngagement(yesterday).then((v) => ({ metric: 'quiz_engagement', value: v })),
      computeMissionsCompleted(yesterday).then((v) => ({ metric: 'missions_completed', value: v })),
      computeMissionsClaimed(yesterday).then((v) => ({ metric: 'missions_claimed', value: v })),
    ]);

    for (const { metric, value } of metrics) {
      await prisma.analyticsSnapshot.upsert({
        where: { date_metric: { date: yesterday, metric } },
        update: { value },
        create: { date: yesterday, metric, value },
      });
    }

    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        output: { processed: metrics.length },
      },
    });

    logger.info({ processed: metrics.length }, 'compute-analytics job completed');
  } catch (e) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: 'error', finishedAt: new Date(), output: { error: String(e) } },
    });
    throw e;
  }
}

/**
 * Cron job to compute analytics snapshots daily at 02:00 UTC.
 */
export function startComputeAnalyticsJob() {
  if (activeJob) return;
  activeJob = cron.schedule('0 2 * * *', async () => {
    logger.info('Starting daily analytics computation...');
    await runComputeAnalytics('cron').catch((err) =>
      logger.error({ err }, 'compute-analytics job failed'),
    );
  });
  logger.info('compute-analytics job scheduled: daily at 02:00 UTC');
}
