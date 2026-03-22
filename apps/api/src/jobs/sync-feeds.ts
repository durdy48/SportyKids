import cron from 'node-cron';
import { syncAllSources } from '../services/aggregator';

let activeJob: cron.ScheduledTask | null = null;

// Run synchronization every 30 minutes
export function startSyncJob(): void {
  if (activeJob) {
    console.log('Sync job is already active.');
    return;
  }

  activeJob = cron.schedule('*/30 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled synchronization...`);
    await syncAllSources();
  });

  console.log('Sync job scheduled: every 30 minutes.');
}

// Manual synchronization (on startup or from admin route)
export async function runManualSync(): Promise<number> {
  console.log(`[${new Date().toISOString()}] Running manual synchronization...`);
  return syncAllSources();
}
