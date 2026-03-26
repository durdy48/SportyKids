import cron from 'node-cron';
import { syncAllTeamStats } from '../services/team-stats-sync';

let activeJob: cron.ScheduledTask | null = null;

/**
 * Cron job to sync team stats from TheSportsDB daily at 04:00 UTC (B-CP3).
 */
export function startTeamStatsSyncJob() {
  if (activeJob) return;
  activeJob = cron.schedule('0 4 * * *', async () => {
    console.log('[team-stats-sync] Starting daily team stats sync...');
    try {
      const result = await syncAllTeamStats();
      console.log(`[team-stats-sync] Done. Synced: ${result.synced}, Failed: ${result.failed}`);
    } catch (err) {
      console.error('[team-stats-sync] Error:', err);
    }
  });
  console.log('[team-stats-sync] Cron scheduled: daily at 04:00 UTC');
}
