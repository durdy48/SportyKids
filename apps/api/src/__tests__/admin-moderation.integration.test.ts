import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock dependencies
vi.mock('../config/database', () => ({
  prisma: {
    newsItem: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    reel: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    rssSource: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    videoSource: {
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
    vi.mocked(prisma.newsItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.newsItem.count).mockResolvedValue(0);
    vi.mocked(prisma.reel.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reel.count).mockResolvedValue(0);
    vi.mocked(prisma.rssSource.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.videoSource.findMany).mockResolvedValue([]);
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

  it('returns paginated pending items with news and reels', async () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60_000);
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);

    const mockNews = [
      {
        id: 'n1',
        title: 'News 1',
        source: 'AS',
        sport: 'football',
        safetyReason: null,
        createdAt: tenMinAgo,
        sourceUrl: 'https://as.com/1',
        imageUrl: null,
      },
    ];
    const mockReels = [
      {
        id: 'r1',
        title: 'Reel 1',
        sport: 'tennis',
        videoSourceId: 'vs1',
        safetyReason: null,
        createdAt: fiveMinAgo,
        videoUrl: 'https://yt.com/r1',
        thumbnailUrl: null,
      },
    ];

    vi.mocked(prisma.newsItem.findMany).mockResolvedValueOnce(mockNews as never);
    vi.mocked(prisma.newsItem.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.reel.findMany).mockResolvedValueOnce(mockReels as never);
    vi.mocked(prisma.reel.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.videoSource.findMany).mockResolvedValueOnce([{ id: 'vs1', name: 'Tennis Channel' }] as never);

    const app = createTestApp();
    const res = await request(app)
      .get('/api/admin/moderation/pending')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(2);

    // Sorted by pendingSinceMinutes descending — oldest (news, 10min ago) first
    expect(res.body.items[0].id).toBe('n1');
    expect(res.body.items[0].type).toBe('news');
    expect(res.body.items[1].id).toBe('r1');
    expect(res.body.items[1].type).toBe('reel');
    expect(res.body.items[1].source).toBe('Tennis Channel');
  });

  it('returns empty list when nothing is pending', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/api/admin/moderation/pending')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });

  it('queries with safetyStatus: pending, createdAt asc, and take: 2000', async () => {
    const app = createTestApp();
    await request(app)
      .get('/api/admin/moderation/pending')
      .set('Authorization', 'Bearer admin-token');

    expect(prisma.newsItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { safetyStatus: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 2000,
      }),
    );
    expect(prisma.reel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { safetyStatus: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 2000,
      }),
    );
  });

  it('truncates long safetyReason in the URL field', async () => {
    const mockNews = [
      {
        id: 'n1',
        title: 'Long News',
        source: 'BBC',
        sport: 'tennis',
        safetyReason: 'A'.repeat(300),
        createdAt: new Date(),
        sourceUrl: 'https://bbc.com/1',
        imageUrl: null,
      },
    ];

    vi.mocked(prisma.newsItem.findMany).mockResolvedValueOnce(mockNews as never);
    vi.mocked(prisma.newsItem.count).mockResolvedValueOnce(1);

    const app = createTestApp();
    const res = await request(app)
      .get('/api/admin/moderation/pending')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.items[0].id).toBe('n1');
  });
});
