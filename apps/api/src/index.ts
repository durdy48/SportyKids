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
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { startSyncJob, runManualSync } from './jobs/sync-feeds';
import { startWeeklyDigestJob } from './jobs/send-weekly-digests';
import { startDailyMissionsJob } from './jobs/generate-daily-missions';
import { startStreakReminderJob } from './jobs/streak-reminder';
import { startTeamStatsSyncJob } from './jobs/sync-team-stats';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(authMiddleware);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/news', newsRouter);
app.use('/api/users', usersRouter);
app.use('/api/reels', reelsRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/parents', parentsRouter);
app.use('/api/gamification', gamificationRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/reports', reportRoutes);
app.use('/api/missions', missionRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`SportyKids API running at http://localhost:${PORT}`);

  // Initial sync on startup
  runManualSync().catch(console.error);

  // Schedule periodic sync
  startSyncJob();

  // Schedule weekly digest job
  startWeeklyDigestJob();

  // Schedule daily missions generation
  startDailyMissionsJob();

  // Schedule streak reminder notifications
  startStreakReminderJob();

  // Schedule daily team stats sync from TheSportsDB
  startTeamStatsSyncJob();
});
