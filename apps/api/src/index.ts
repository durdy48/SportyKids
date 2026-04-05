import dotenv from 'dotenv';
dotenv.config();

import { initSentry } from './services/monitoring';
initSentry();

import express from 'express';
import cors from 'cors';
import { prisma, waitForDatabase, startDatabaseKeepAlive } from './config/database';
import newsRouter from './routes/news';
import usersRouter from './routes/users';
import reelsRouter from './routes/reels';
import quizRouter from './routes/quiz';
import parentsRouter from './routes/parents';
import gamificationRouter from './routes/gamification';
import teamsRouter from './routes/teams';
import reportRoutes from './routes/reports';
import missionRoutes from './routes/missions';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import subscriptionRouter from './routes/subscription';
import liveRouter from './routes/live';
import organizationsRouter from './routes/organizations';
import { errorHandler } from './middleware/error-handler';
import { requestIdMiddleware } from './middleware/request-id';
import { authMiddleware } from './middleware/auth';
import { authLimiter, pinLimiter, contentLimiter, syncLimiter, defaultLimiter } from './middleware/rate-limiter';
import { startSyncJob, runManualSync } from './jobs/sync-feeds';
import { startWeeklyDigestJob } from './jobs/send-weekly-digests';
import { startDailyMissionsJob } from './jobs/generate-daily-missions';
import { startStreakReminderJob } from './jobs/streak-reminder';
import { startMissionReminderJob } from './jobs/mission-reminder';
import { startTeamStatsSyncJob } from './jobs/sync-team-stats';
import { startVideoSyncJob, runManualVideoSync } from './jobs/sync-videos';
import { startLiveScoresJob } from './jobs/live-scores';
import { startTimelessQuizJob } from './jobs/generate-timeless-quiz';
import { startComputeAnalyticsJob } from './jobs/compute-analytics';
import { logger } from './services/logger';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Fly.io / reverse proxy (needed for express-rate-limit with X-Forwarded-For)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(requestIdMiddleware);
app.use(cors());
app.use(express.json());
app.use(authMiddleware);

// Health check (before rate limiters so monitoring is never throttled)
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'unavailable', timestamp: new Date().toISOString() });
  }
});

// Rate limiters — specific tiers before default (defense-in-depth).
// Note: a request to e.g. /api/news matches both contentLimiter AND defaultLimiter,
// consuming quota from both. This is intentional as defense-in-depth.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/join-organization', authLimiter);
app.use('/api/parents/verify-pin', pinLimiter);
app.use('/api/news/sync', syncLimiter);
app.use('/api/reels/sync', syncLimiter);
app.use('/api/teams/sync', syncLimiter);
app.use('/api/news', contentLimiter);
app.use('/api/reels', contentLimiter);
app.use('/api/quiz', contentLimiter);
app.use('/api', defaultLimiter);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/news', newsRouter);
app.use('/api/users', usersRouter);
app.use('/api/reels', reelsRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/parents', parentsRouter);
app.use('/api/gamification', gamificationRouter);
app.use('/api/teams', liveRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/reports', reportRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/organizations', organizationsRouter);

// Global error handler
app.use(errorHandler);

// Start server — wait for DB to be reachable before accepting traffic.
// This handles Neon cold starts (free tier auto-suspends after inactivity).
async function cleanupStaleJobRuns(): Promise<void> {
  try {
    // Any job left in 'running' state at startup was killed mid-execution — mark as error.
    const { count } = await prisma.jobRun.updateMany({
      where: { status: 'running' },
      data: { status: 'error', finishedAt: new Date(), output: { error: 'Process terminated before job completed' } },
    });
    if (count > 0) {
      logger.info({ count }, 'Marked stale running job runs as error on startup');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to clean up stale job runs');
  }
}

async function start() {
  logger.info('Waiting for database...');
  await waitForDatabase();
  logger.info('Database ready');
  await cleanupStaleJobRuns();
  startDatabaseKeepAlive();

  app.listen(PORT, () => {
    logger.info({ port: PORT }, `SportyKids API running at http://localhost:${PORT}`);

    // -------------------------------------------------------------------------
    // Cron jobs — run on every started machine. With min_machines_running = 1
    // in fly.toml, Fly.io always keeps exactly one machine running, so crons
    // execute reliably. During rolling deploys there may be a brief two-machine
    // overlap, but all jobs are idempotent (upserts / dedup by rssGuid).
    // -------------------------------------------------------------------------
    logger.info('Starting cron jobs');

    // Initial sync on startup — delayed in dev to avoid saturating the AI rate
    // limiter with bulk moderation before user-facing requests can go through.
    const syncDelay = process.env.NODE_ENV === 'production' ? 0 : 30_000;
    setTimeout(() => {
      runManualSync().catch((err) => logger.error({ err }, 'Initial sync failed'));
    }, syncDelay);

    // Schedule periodic sync
    startSyncJob();

    // Schedule weekly digest job
    startWeeklyDigestJob();

    // Schedule daily missions generation
    startDailyMissionsJob();

    // Schedule streak reminder notifications
    startStreakReminderJob();

    // Schedule daily mission reminders (18:00 UTC)
    startMissionReminderJob();

    // Schedule daily team stats sync from TheSportsDB
    startTeamStatsSyncJob();

    // Initial video sync on startup + schedule periodic sync — same delay as news sync
    setTimeout(() => {
      runManualVideoSync().catch((err) => logger.error({ err }, 'Initial video sync failed'));
    }, syncDelay);
    startVideoSyncJob();

    // Schedule live score polling (every 5 minutes)
    startLiveScoresJob();

    // Schedule weekly timeless quiz generation (Monday 05:00 UTC)
    startTimelessQuizJob();

    // Schedule daily analytics computation (02:00 UTC)
    startComputeAnalyticsJob();
  });
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server — database unreachable');
  process.exit(1);
});
