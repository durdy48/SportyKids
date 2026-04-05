import { prisma } from '../config/database';
import { logger } from './logger';
import { runSyncFeeds } from '../jobs/sync-feeds';
import { runSyncVideos } from '../jobs/sync-videos';
import { runSyncTeamStats } from '../jobs/sync-team-stats';
import { runGenerateDailyQuiz } from '../jobs/generate-daily-quiz';
import { runGenerateTimelessQuiz } from '../jobs/generate-timeless-quiz';
import { runGenerateDailyMissions } from '../jobs/generate-daily-missions';
import { runStreakReminder } from '../jobs/streak-reminder';
import { runMissionReminder } from '../jobs/mission-reminder';
import { runSendWeeklyDigests } from '../jobs/send-weekly-digests';
import { runLiveScores } from '../jobs/live-scores';
import { runComputeAnalytics } from '../jobs/compute-analytics';

export const JOB_FREQUENCIES: Record<string, number> = {
  'sync-feeds': 30,
  'sync-videos': 360,
  'sync-team-stats': 1440,
  'generate-daily-quiz': 1440,
  'generate-timeless-quiz': 1440,
  'generate-daily-missions': 1440,
  'streak-reminder': 1440,
  'mission-reminder': 1440,
  'send-weekly-digests': 10080,
  'live-scores': 5,
  'compute-analytics': 1440,
};

type JobFn = (triggeredBy: 'cron' | 'manual', triggeredId?: string, existingRunId?: string) => Promise<void>;

export const KNOWN_JOBS = Object.keys(JOB_FREQUENCIES);

const JOB_MAP: Record<string, JobFn> = {
  'sync-feeds': runSyncFeeds,
  'sync-videos': runSyncVideos,
  'sync-team-stats': runSyncTeamStats,
  'generate-daily-quiz': runGenerateDailyQuiz,
  'generate-timeless-quiz': runGenerateTimelessQuiz,
  'generate-daily-missions': runGenerateDailyMissions,
  'streak-reminder': runStreakReminder,
  'mission-reminder': runMissionReminder,
  'send-weekly-digests': runSendWeeklyDigests,
  'live-scores': runLiveScores,
  'compute-analytics': runComputeAnalytics,
};

// Verify JOB_MAP and JOB_FREQUENCIES are in sync
if (process.env.NODE_ENV !== 'test') {
  const mapKeys = Object.keys(JOB_MAP).sort().join(',');
  const freqKeys = KNOWN_JOBS.slice().sort().join(',');
  if (mapKeys !== freqKeys) {
    throw new Error(`JOB_MAP and JOB_FREQUENCIES are out of sync: map=[${mapKeys}] freq=[${freqKeys}]`);
  }
}

export async function triggerJob(jobName: string, adminUserId: string): Promise<{ jobRunId: string }> {
  if (!KNOWN_JOBS.includes(jobName)) {
    throw new Error(`Unknown job: ${jobName}`);
  }

  const fn = JOB_MAP[jobName]!;

  // Pre-create the JobRun record so we can return the ID immediately
  const run = await prisma.jobRun.create({
    data: { jobName, status: 'running', triggeredBy: 'manual', triggeredId: adminUserId },
  });

  // Run async — do not await. Pass existingRunId so the job skips its own create call.
  fn('manual', adminUserId, run.id).catch(err => {
    logger.error({ jobName, err }, 'Manual job trigger failed');
  });

  return { jobRunId: run.id };
}
