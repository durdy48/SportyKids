import cron from 'node-cron';
import { syncAllTeamStats } from '../services/team-stats-sync';
import { prisma } from '../config/database';
import { logger } from '../services/logger';

let activeJob: cron.ScheduledTask | null = null;

export async function runSyncTeamStats(triggeredBy: 'cron' | 'manual' = 'cron', triggeredId?: string, existingRunId?: string): Promise<void> {
  const run = existingRunId
    ? { id: existingRunId }
    : await prisma.jobRun.create({
        data: { jobName: 'sync-team-stats', status: 'running', triggeredBy, triggeredId },
      });
  try {
    const result = await syncAllTeamStats();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        output: { synced: result.synced, failed: result.failed },
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

/**
 * Cron job to sync team stats from TheSportsDB daily at 04:00 UTC (B-CP3).
 */
export function startTeamStatsSyncJob() {
  if (activeJob) return;
  activeJob = cron.schedule('0 4 * * *', async () => {
    logger.info('Starting daily team stats sync...');
    await runSyncTeamStats('cron');
  });
  logger.info('Team stats sync job scheduled: daily at 04:00 UTC');
}
