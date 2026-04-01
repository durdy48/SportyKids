import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock dependencies
vi.mock('../config/database', () => ({
  prisma: {
    newsItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    reel: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('../services/logger', () => {
  const noopLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => noopLogger),
  };
  return {
    logger: noopLogger,
    createRequestLogger: vi.fn(() => noopLogger),
  };
});

vi.mock('../services/monitoring', () => ({
  captureException: vi.fn(),
}));

vi.mock('../services/auth-service', () => ({
  verifyAccessToken: vi.fn((token: string) => {
    if (token === 'admin-token') return { userId: 'admin1', role: 'admin' };
    if (token === 'child-token') return { userId: 'child1', role: 'child' };
    return null;
  }),
}));

import { prisma } from '../config/database';
import adminRouter from '../routes/admin';
import { authMiddleware } from '../middleware/auth';
import { requestIdMiddleware } from '../middleware/request-id';
import { errorHandler } from '../middleware/error-handler';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use(authMiddleware);
  app.use('/api/admin', adminRouter);
  app.use(errorHandler);
  return app;
}

describe('GET /api/admin/moderation/pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth token', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/admin/moderation/pending');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/api/admin/moderation/pending')
      .set('Authorization', 'Bearer child-token');
    expect(res.status).toBe(403);
  });

  it('returns flat pending array with news and reels', async () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60_000);
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);

    const mockNews = [
      {
        id: 'n1',
        title: 'News 1',
        summary: 'Full news content here that is used to build the summary field',
        source: 'AS',
        sport: 'football',
        safetyReason: null,
        createdAt: tenMinAgo,
      },
    ];
    const mockReels = [
      {
        id: 'r1',
        title: 'Reel 1',
        sport: 'tennis',
        safetyReason: null,
        createdAt: fiveMinAgo,
      },
    ];

    vi.mocked(prisma.newsItem.findMany).mockResolvedValueOnce(mockNews as never);
    vi.mocked(prisma.reel.findMany).mockResolvedValueOnce(mockReels as never);

    const app = createTestApp();
    const res = await request(app)
      .get('/api/admin/moderation/pending')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.pending).toHaveLength(2);

    // Sorted by createdAt ASC — oldest first
    expect(res.body.pending[0].id).toBe('n1');
    expect(res.body.pending[0].type).toBe('news');
    // summary is sliced to 200 chars from the DB summary field
    expect(res.body.pending[0].summary).toBe(
      'Full news content here that is used to build the summary field',
    );
    expect(res.body.pending[0].pendingMinutes).toBeGreaterThanOrEqual(9);

    expect(res.body.pending[1].id).toBe('r1');
    expect(res.body.pending[1].type).toBe('reel');

    // oldestPendingMinutes matches the first (oldest) item
    expect(res.body.oldestPendingMinutes).toBeGreaterThanOrEqual(9);
  });

  it('returns empty list when nothing is pending', async () => {
    vi.mocked(prisma.newsItem.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.reel.findMany).mockResolvedValueOnce([]);

    const app = createTestApp();
    const res = await request(app)
      .get('/api/admin/moderation/pending')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.pending).toHaveLength(0);
    expect(res.body.oldestPendingMinutes).toBe(0);
  });

  it('queries with safetyStatus: pending and createdAt asc', async () => {
    vi.mocked(prisma.newsItem.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.reel.findMany).mockResolvedValueOnce([]);

    const app = createTestApp();
    await request(app)
      .get('/api/admin/moderation/pending')
      .set('Authorization', 'Bearer admin-token');

    expect(prisma.newsItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { safetyStatus: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    );
    expect(prisma.reel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { safetyStatus: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    );
  });

  it('truncates summary to 200 characters', async () => {
    const longContent = 'A'.repeat(300);
    const mockNews = [
      {
        id: 'n1',
        title: 'Long News',
        summary: longContent,
        source: 'BBC',
        sport: 'tennis',
        safetyReason: null,
        createdAt: new Date(),
      },
    ];

    vi.mocked(prisma.newsItem.findMany).mockResolvedValueOnce(mockNews as never);
    vi.mocked(prisma.reel.findMany).mockResolvedValueOnce([]);

    const app = createTestApp();
    const res = await request(app)
      .get('/api/admin/moderation/pending')
      .set('Authorization', 'Bearer admin-token');

    expect(res.body.pending[0].summary).toHaveLength(200);
  });
});
