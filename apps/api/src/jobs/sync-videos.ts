import cron from 'node-cron';
import { syncAllVideoSources, VideoSyncAllResult } from '../services/video-aggregator';

let activeJob: cron.ScheduledTask | null = null;

/**
 * Schedule video source sync every 6 hours.
 */
export function startVideoSyncJob(): void {
  if (activeJob) {
    console.log('Video sync job is already active.');
    return;
  }

  activeJob = cron.schedule('0 */6 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled video synchronization...`);
    await syncAllVideoSources();
  });

  console.log('Video sync job scheduled: every 6 hours.');
}

/**
 * Manual video sync (on startup or from admin route).
 */
export async function runManualVideoSync(): Promise<VideoSyncAllResult> {
  console.log(`[${new Date().toISOString()}] Running manual video synchronization...`);
  return syncAllVideoSources();
}
