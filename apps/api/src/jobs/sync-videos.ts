import cron from 'node-cron';
import { syncAllVideoSources, VideoSyncAllResult } from '../services/video-aggregator';
import { prisma } from '../config/database';
import { logger } from '../services/logger';

let activeJob: cron.ScheduledTask | null = null;

export async function runSyncVideos(triggeredBy: 'cron' | 'manual' = 'cron', triggeredId?: string, existingRunId?: string): Promise<void> {
  const run = existingRunId
    ? { id: existingRunId }
    : await prisma.jobRun.create({
        data: { jobName: 'sync-videos', status: 'running', triggeredBy, triggeredId },
      });
  try {
    const result = await syncAllVideoSources();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        output: { processed: result.totalProcessed ?? 0, errors: result.totalErrors ?? 0 },
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
 * Schedule video source sync every 6 hours.
 */
export function startVideoSyncJob(): void {
  if (activeJob) {
    logger.info('Video sync job is already active.');
    return;
  }

  activeJob = cron.schedule('0 */6 * * *', async () => {
    logger.info('Running scheduled video synchronization...');
    await runSyncVideos('cron');
  });

  logger.info('Video sync job scheduled: every 6 hours.');
}

/**
 * Manual video sync (on startup or from admin route).
 */
export async function runManualVideoSync(): Promise<VideoSyncAllResult> {
  logger.info('Running manual video synchronization...');
  return syncAllVideoSources();
}
