import cron from 'node-cron';
import { syncAllTeamStats } from '../services/team-stats-sync';
import { logger } from '../services/logger';

let activeJob: cron.ScheduledTask | null = null;

/**
 * Cron job to sync team stats from TheSportsDB daily at 04:00 UTC (B-CP3).
 */
export function startTeamStatsSyncJob() {
  if (activeJob) return;
  activeJob = cron.schedule('0 4 * * *', async () => {
    logger.info('Starting daily team stats sync...');
    try {
      const result = await syncAllTeamStats();
      logger.info({ synced: result.synced, failed: result.failed }, 'Team stats sync completed');
    } catch (err) {
      logger.error({ err }, 'Team stats sync error');
    }
  });
  logger.info('Team stats sync job scheduled: daily at 04:00 UTC');
}
