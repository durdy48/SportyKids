import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import newsRouter from './routes/news';
import usersRouter from './routes/users';
import reelsRouter from './routes/reels';
import quizRouter from './routes/quiz';
import parentsRouter from './routes/parents';
import { errorHandler } from './middleware/error-handler';
import { startSyncJob, runManualSync } from './jobs/sync-feeds';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/news', newsRouter);
app.use('/api/users', usersRouter);
app.use('/api/reels', reelsRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/parents', parentsRouter);

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
});
