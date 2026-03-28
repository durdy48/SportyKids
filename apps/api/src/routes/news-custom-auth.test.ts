import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies — auth middleware is NOT mocked to pass-through
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  rssSource: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  newsItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  activityLog: {
    findMany: vi.fn(),
  },
  newsSummary: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/cache', () => ({
  apiCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn(), invalidatePattern: vi.fn() },
  CACHE_TTL: { NEWS: 300000, TRENDING: 300000, SOURCES: 600000 },
  CACHE_KEYS: {},
  withCache: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../services/feed-ranker', () => ({
  rankFeed: vi.fn((items: unknown[]) => items),
  getBehavioralSignals: vi.fn().mockResolvedValue({
    sportEngagement: new Map(),
    sourceEngagement: new Map(),
    readContentIds: new Set(),
  }),
}));

vi.mock('../middleware/parental-guard', () => ({
  parentalGuard: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../utils/url-validator', () => ({
  isPublicUrl: () => ({ valid: true }),
}));

vi.mock('../services/aggregator', () => ({
  syncSource: vi.fn(),
}));

vi.mock('../jobs/sync-feeds', () => ({
  runManualSync: vi.fn().mockResolvedValue({
    totalProcessed: 0, totalCreated: 0, totalApproved: 0,
    totalRejected: 0, totalErrors: 0, sources: [],
  }),
}));

vi.mock('../services/summarizer', () => ({
  generateSummary: vi.fn(),
}));

vi.mock('../services/monitoring', () => ({
  captureException: vi.fn(),
  trackEvent: vi.fn(),
}));

// DO NOT mock auth — use real middleware so requireAuth rejects without a JWT
vi.mock('../services/auth-service', () => ({
  verifyAccessToken: vi.fn().mockReturnValue(null),
}));

import express from 'express';
import request from 'supertest';
import { authMiddleware } from '../middleware/auth';
import newsRouter from './news';
import { errorHandler } from '../middleware/error-handler';

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { log: typeof mockLog; requestId: string }).log = mockLog;
    (req as express.Request & { requestId: string }).requestId = 'test-req-id';
    next();
  });
  app.use(authMiddleware);
  app.use('/api/news', newsRouter);
  app.use(errorHandler as express.ErrorRequestHandler);
  return app;
}

describe('POST /api/news/sources/custom — auth required', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth token', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/news/sources/custom')
      .send({
        name: 'Test Source',
        url: 'https://example.com/rss',
        sport: 'football',
        userId: 'user-1',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
  });
});
