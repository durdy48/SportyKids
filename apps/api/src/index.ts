import dotenv from 'dotenv';
dotenv.config();

import { initSentry } from './services/monitoring';
initSentry();

import express from 'express';
import cors from 'cors';
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
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, `SportyKids API running at http://localhost:${PORT}`);

  // ---------------------------------------------------------------------------
  // Cron jobs — only run on the primary machine to avoid duplicate execution
  // when scaled horizontally. Set PRIMARY_MACHINE_ID to the Fly machine ID
  // that should run crons (e.g. fly machine list --app sportykids-api).
  // If unset, the first machine to start runs crons (single-machine default).
  // ---------------------------------------------------------------------------
  const machineId = process.env.FLY_MACHINE_ID ?? 'local';
  const primaryId = process.env.PRIMARY_MACHINE_ID ?? machineId;
  const isPrimary = machineId === primaryId;

  if (isPrimary) {
    logger.info({ machineId }, 'Primary machine — starting cron jobs');

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
  } else {
    logger.info({ machineId, primaryId }, 'Worker machine — skipping cron jobs (HTTP only)');
  }
});
