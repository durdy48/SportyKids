import cron from 'node-cron';
import { syncAllVideoSources, VideoSyncAllResult } from '../services/video-aggregator';
import { logger } from '../services/logger';

let activeJob: cron.ScheduledTask | null = null;

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
    await syncAllVideoSources();
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
