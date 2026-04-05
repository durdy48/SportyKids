import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mock for Prisma
// ---------------------------------------------------------------------------
const mockPrisma = vi.hoisted(() => ({
  newsItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  reel: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  rssSource: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  videoSource: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  contentReport: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    update: vi.fn(),
  },
  activityLog: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  jobRun: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  analyticsSnapshot: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
  userSticker: {
    count: vi.fn(),
  },
  userAchievement: {
    count: vi.fn(),
  },
  userQuizHistory: {
    count: vi.fn(),
  },
  refreshToken: {
    deleteMany: vi.fn(),
  },
  organization: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  $queryRaw: vi.fn(),
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockGenerateDailyQuiz = vi.hoisted(() => vi.fn().mockResolvedValue({ generated: 5, errors: [] }));

vi.mock('../jobs/generate-daily-quiz', () => ({
  generateDailyQuiz: mockGenerateDailyQuiz,
}));

const mockTriggerJob = vi.hoisted(() => vi.fn().mockResolvedValue({ jobRunId: 'run-123' }));

vi.mock('../services/job-runner', () => ({
  KNOWN_JOBS: ['sync-feeds', 'sync-videos', 'sync-team-stats', 'generate-daily-quiz', 'generate-timeless-quiz', 'generate-daily-missions', 'streak-reminder', 'mission-reminder', 'send-weekly-digests', 'live-scores', 'compute-analytics'],
  JOB_FREQUENCIES: {
    'sync-feeds': 60,
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
  },
  triggerJob: mockTriggerJob,
}));

const mockGenerateUniqueCode = vi.hoisted(() => vi.fn().mockResolvedValue('NEWCDE'));

vi.mock('../services/invite-code', () => ({
  generateUniqueCode: mockGenerateUniqueCode,
  generateUniqueSlug: vi.fn().mockResolvedValue('test-slug'),
}));

const mockSyncSingleSource = vi.hoisted(() => vi.fn().mockResolvedValue({ processed: 3, errors: 0 }));

vi.mock('../services/aggregator', () => ({
  syncSingleSource: mockSyncSingleSource,
}));

const mockSyncSingleVideoSource = vi.hoisted(() => vi.fn().mockResolvedValue({ processed: 2, errors: 0 }));

vi.mock('../services/video-aggregator', () => ({
  syncSingleVideoSource: mockSyncSingleVideoSource,
}));

const mockParseURL = vi.hoisted(() => vi.fn());

vi.mock('rss-parser', () => {
  class MockParser {
    parseURL = mockParseURL;
  }
  return { default: MockParser };
});

vi.mock('../services/monitoring', () => ({
  captureException: vi.fn(),
  trackEvent: vi.fn(),
}));

// Mock the cache so withCache middleware is a no-op in tests
vi.mock('../services/cache', () => ({
  apiCache: {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    has: vi.fn().mockReturnValue(false),
    invalidate: vi.fn(),
    invalidatePattern: vi.fn(),
    clear: vi.fn(),
    size: 0,
    stats: { size: 0, maxEntries: 0, hits: 0, misses: 0, hitRate: '0%' },
  },
  withCache: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  CACHE_TTL: { NEWS: 300_000, TEAM_STATS: 3_600_000, STICKERS_CATALOG: 86_400_000, SOURCES: 600_000, TRENDING: 300_000, READING_HISTORY: 120_000, LIVE_MATCH: 60_000 },
  CACHE_KEYS: { news: (p: string) => `news:${p}`, newsItem: (id: string) => `news:item:${id}`, teamStats: (t: string) => `team:stats:${t}`, stickersCatalog: () => 'stickers:catalog', trending: () => 'news:trending', sources: () => 'sources:list', sourcesCatalog: () => 'sources:catalog', readingHistory: (uid: string) => `history:${uid}`, recommendations: (id: string) => `recommendations:${id}` },
}));

// ---------------------------------------------------------------------------
// Mock verifyAccessToken so we can control auth in tests
// ---------------------------------------------------------------------------
const mockVerifyAccessToken = vi.hoisted(() => vi.fn());

vi.mock('../services/auth-service', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

import { authMiddleware } from '../middleware/auth';
import adminRouter from './admin';
import { errorHandler } from '../middleware/error-handler';

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------
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
  app.use('/api/admin', adminRouter);
  app.use(errorHandler as express.ErrorRequestHandler);
  return app;
}

function asAdmin() {
  mockVerifyAccessToken.mockReturnValue({ userId: 'admin-1', role: 'admin' });
}

function asChild() {
  mockVerifyAccessToken.mockReturnValue({ userId: 'child-1', role: 'child' });
}

function noAuth() {
  mockVerifyAccessToken.mockReturnValue(null);
}

// ---------------------------------------------------------------------------
// GET /api/admin/moderation/pending
// ---------------------------------------------------------------------------
describe('GET /api/admin/moderation/pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.videoSource.findMany.mockResolvedValue([]);
    mockPrisma.rssSource.findUnique.mockResolvedValue(null);
    mockPrisma.newsItem.count.mockResolvedValue(0);
    mockPrisma.reel.count.mockResolvedValue(0);
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/moderation/pending');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    asChild();
    const res = await request(createApp())
      .get('/api/admin/moderation/pending')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns paginated pending items (news + reels)', async () => {
    asAdmin();
    // newsItem is intentionally 1 hour older than reelItem so that after the
    // server-side sort (pendingSinceMinutes desc), news appears first in the response.
    const newsItem = {
      id: 'n1', title: 'News 1', sport: 'football', source: 'BBC', safetyReason: 'gambling',
      createdAt: new Date('2026-01-01T10:00:00Z'), sourceUrl: 'https://bbc.com/news/1', imageUrl: '',
    };
    const reelItem = {
      id: 'r1', title: 'Reel 1', sport: 'tennis', videoSourceId: 'vs1', safetyReason: null,
      createdAt: new Date('2026-01-01T11:00:00Z'), videoUrl: 'https://yt.com/r1', thumbnailUrl: '',
    };
    mockPrisma.newsItem.findMany.mockResolvedValue([newsItem]);
    mockPrisma.newsItem.count.mockResolvedValue(1);
    mockPrisma.reel.findMany.mockResolvedValue([reelItem]);
    mockPrisma.reel.count.mockResolvedValue(1);
    mockPrisma.videoSource.findMany.mockResolvedValue([{ id: 'vs1', name: 'Tennis Channel' }]);

    const res = await request(createApp()).get('/api/admin/moderation/pending').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.items[0].type).toBe('news');
    expect(res.body.items[1].type).toBe('reel');
    expect(res.body.items[1].source).toBe('Tennis Channel');
  });

  it('filters by type=news (skips reels query)', async () => {
    asAdmin();
    mockPrisma.newsItem.findMany.mockResolvedValue([]);
    mockPrisma.reel.findMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get('/api/admin/moderation/pending?type=news')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockPrisma.newsItem.findMany).toHaveBeenCalledOnce();
    expect(mockPrisma.reel.findMany).not.toHaveBeenCalled();
  });

  it('filters by type=reel (skips news query)', async () => {
    asAdmin();
    mockPrisma.reel.findMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get('/api/admin/moderation/pending?type=reel')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockPrisma.newsItem.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.reel.findMany).toHaveBeenCalledOnce();
  });

  it('filters by sport', async () => {
    asAdmin();
    mockPrisma.newsItem.findMany.mockResolvedValue([]);
    mockPrisma.reel.findMany.mockResolvedValue([]);

    await request(createApp())
      .get('/api/admin/moderation/pending?sport=football')
      .set('Authorization', 'Bearer tok');

    expect(mockPrisma.newsItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sport: 'football' }) }),
    );
  });

  it('respects pagination params', async () => {
    asAdmin();
    mockPrisma.newsItem.findMany.mockResolvedValue([]);
    mockPrisma.reel.findMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get('/api/admin/moderation/pending?page=2&limit=5')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/content/news/:id/approve
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/content/news/:id/approve', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).patch('/api/admin/content/news/n1/approve');
    expect(res.status).toBe(401);
  });

  it('approves a news item', async () => {
    asAdmin();
    mockPrisma.newsItem.update.mockResolvedValue({
      id: 'n1', safetyStatus: 'approved', moderatedAt: new Date(),
    });
    const res = await request(createApp())
      .patch('/api/admin/content/news/n1/approve')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body.safetyStatus).toBe('approved');
    expect(mockPrisma.newsItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'n1' }, data: expect.objectContaining({ safetyStatus: 'approved' }) }),
    );
  });

  it('returns 400 for invalid type', async () => {
    asAdmin();
    const res = await request(createApp())
      .patch('/api/admin/content/invalid/n1/approve')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/content/reel/:id/approve
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/content/reel/:id/approve', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approves a reel', async () => {
    asAdmin();
    mockPrisma.reel.update.mockResolvedValue({
      id: 'r1', safetyStatus: 'approved', moderatedAt: new Date(),
    });
    const res = await request(createApp())
      .patch('/api/admin/content/reel/r1/approve')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body.safetyStatus).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/content/news/:id/reject
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/content/news/:id/reject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when reason is missing', async () => {
    asAdmin();
    const res = await request(createApp())
      .patch('/api/admin/content/news/n1/reject')
      .set('Authorization', 'Bearer tok')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is too short', async () => {
    asAdmin();
    const res = await request(createApp())
      .patch('/api/admin/content/news/n1/reject')
      .set('Authorization', 'Bearer tok')
      .send({ reason: 'ab' });
    expect(res.status).toBe(400);
  });

  it('rejects a news item with a valid reason', async () => {
    asAdmin();
    mockPrisma.newsItem.update.mockResolvedValue({
      id: 'n1', safetyStatus: 'rejected', safetyReason: 'gambling content', moderatedAt: new Date(),
    });
    const res = await request(createApp())
      .patch('/api/admin/content/news/n1/reject')
      .set('Authorization', 'Bearer tok')
      .send({ reason: 'gambling content' });
    expect(res.status).toBe(200);
    expect(res.body.safetyStatus).toBe('rejected');
    expect(res.body.safetyReason).toBe('gambling content');
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/content/batch
// ---------------------------------------------------------------------------
describe('POST /api/admin/content/batch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).post('/api/admin/content/batch').send({
      ids: ['n1', 'n2'], type: 'news', action: 'approve',
    });
    expect(res.status).toBe(401);
  });

  it('approves multiple news items', async () => {
    asAdmin();
    mockPrisma.newsItem.updateMany.mockResolvedValue({ count: 2 });
    const res = await request(createApp())
      .post('/api/admin/content/batch')
      .set('Authorization', 'Bearer tok')
      .send({ ids: ['n1', 'n2'], type: 'news', action: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
  });

  it('rejects multiple reels with reason', async () => {
    asAdmin();
    mockPrisma.reel.updateMany.mockResolvedValue({ count: 3 });
    const res = await request(createApp())
      .post('/api/admin/content/batch')
      .set('Authorization', 'Bearer tok')
      .send({ ids: ['r1', 'r2', 'r3'], type: 'reel', action: 'reject', reason: 'inappropriate content' });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(3);
  });

  it('returns 400 when reject action has no reason', async () => {
    asAdmin();
    const res = await request(createApp())
      .post('/api/admin/content/batch')
      .set('Authorization', 'Bearer tok')
      .send({ ids: ['n1'], type: 'news', action: 'reject' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for more than 100 IDs', async () => {
    asAdmin();
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);
    const res = await request(createApp())
      .post('/api/admin/content/batch')
      .set('Authorization', 'Bearer tok')
      .send({ ids, type: 'news', action: 'approve' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/reports
// ---------------------------------------------------------------------------
describe('GET /api/admin/reports', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/reports');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp())
      .get('/api/admin/reports')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns reports with content titles and user info', async () => {
    asAdmin();
    const now = new Date('2026-04-01T10:00:00Z');
    mockPrisma.contentReport.findMany.mockResolvedValue([
      {
        id: 'rep1', userId: 'u1', contentType: 'news', contentId: 'n1',
        reason: 'scary', comment: 'Too violent', status: 'pending',
        reviewedAt: null, createdAt: now,
      },
    ]);
    mockPrisma.contentReport.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'user@test.com' }]);
    mockPrisma.newsItem.findMany.mockResolvedValue([{ id: 'n1', title: 'Scary News', sourceUrl: 'https://test.com/n1' }]);
    mockPrisma.reel.findMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get('/api/admin/reports')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].contentTitle).toBe('Scary News');
    expect(res.body.items[0].user.email).toBe('user@test.com');
    expect(res.body.items[0].details).toBe('Too violent');
  });

  it('filters by status query param', async () => {
    asAdmin();
    mockPrisma.contentReport.findMany.mockResolvedValue([]);
    mockPrisma.contentReport.count.mockResolvedValue(0);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.newsItem.findMany.mockResolvedValue([]);
    mockPrisma.reel.findMany.mockResolvedValue([]);

    await request(createApp())
      .get('/api/admin/reports?status=pending')
      .set('Authorization', 'Bearer tok');

    expect(mockPrisma.contentReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'pending' }) }),
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/reports/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/reports/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp())
      .patch('/api/admin/reports/rep1')
      .send({ status: 'dismissed' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent report', async () => {
    asAdmin();
    mockPrisma.contentReport.findUnique.mockResolvedValue(null);
    const res = await request(createApp())
      .patch('/api/admin/reports/nonexistent')
      .set('Authorization', 'Bearer tok')
      .send({ status: 'dismissed' });
    expect(res.status).toBe(404);
  });

  it('updates report status', async () => {
    asAdmin();
    mockPrisma.contentReport.findUnique.mockResolvedValue({
      id: 'rep1', contentType: 'news', contentId: 'n1', status: 'pending',
    });
    mockPrisma.contentReport.update.mockResolvedValue({
      id: 'rep1', status: 'dismissed', reviewedAt: new Date(),
    });

    const res = await request(createApp())
      .patch('/api/admin/reports/rep1')
      .set('Authorization', 'Bearer tok')
      .send({ status: 'dismissed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dismissed');
    expect(res.body.reviewedAt).toBeTruthy();
  });

  it('cascades reject_content action to the associated news item', async () => {
    asAdmin();
    mockPrisma.contentReport.findUnique.mockResolvedValue({
      id: 'rep1', contentType: 'news', contentId: 'n1', status: 'pending',
    });
    mockPrisma.contentReport.update.mockResolvedValue({
      id: 'rep1', status: 'actioned', reviewedAt: new Date(),
    });
    mockPrisma.newsItem.update.mockResolvedValue({ id: 'n1', safetyStatus: 'rejected' });

    const res = await request(createApp())
      .patch('/api/admin/reports/rep1')
      .set('Authorization', 'Bearer tok')
      .send({ status: 'actioned', action: 'reject_content' });

    expect(res.status).toBe(200);
    expect(mockPrisma.newsItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1' },
        data: expect.objectContaining({ safetyStatus: 'rejected', safetyReason: 'User report actioned' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/quiz/generate
// ---------------------------------------------------------------------------
describe('POST /api/admin/quiz/generate', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).post('/api/admin/quiz/generate');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    asChild();
    const res = await request(createApp())
      .post('/api/admin/quiz/generate')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns generated quiz stats when successful', async () => {
    asAdmin();
    mockGenerateDailyQuiz.mockResolvedValueOnce({ generated: 10, errors: [] });
    const res = await request(createApp())
      .post('/api/admin/quiz/generate')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.generated).toBe(10);
    expect(res.body.errors).toEqual([]);
  });

  it('returns 500 when generateDailyQuiz throws', async () => {
    asAdmin();
    mockGenerateDailyQuiz.mockRejectedValueOnce(new Error('AI service unavailable'));
    const res = await request(createApp())
      .post('/api/admin/quiz/generate')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to generate quiz');
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/overview
// ---------------------------------------------------------------------------
describe('GET /api/admin/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default happy-path mocks
    mockPrisma.user.count.mockResolvedValue(100);
    mockPrisma.newsItem.count.mockResolvedValue(0);
    mockPrisma.reel.count.mockResolvedValue(0);
    mockPrisma.rssSource.count.mockResolvedValue(10);
    mockPrisma.user.groupBy.mockResolvedValue([
      { subscriptionTier: 'free', _count: 80 },
      { subscriptionTier: 'premium', _count: 20 },
    ]);
    mockPrisma.newsItem.findFirst.mockResolvedValue(null);
    mockPrisma.rssSource.findMany.mockResolvedValue([]);
    mockPrisma.activityLog.findMany.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  it('returns 403 for child role', async () => {
    asChild();
    const res = await request(createApp())
      .get('/api/admin/overview')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns 200 with correct shape { kpis, alerts, subscriptionBreakdown }', async () => {
    asAdmin();
    const res = await request(createApp())
      .get('/api/admin/overview')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('kpis');
    expect(res.body).toHaveProperty('alerts');
    expect(res.body).toHaveProperty('subscriptionBreakdown');
    expect(res.body.kpis.totalUsers).toBe(100);
    expect(res.body.kpis.dau).toBe(2);
    expect(res.body.kpis.pendingContent).toBe(0);
    expect(res.body.kpis.activeRssSources).toBe(10);
    expect(res.body.subscriptionBreakdown.free).toBe(80);
    expect(res.body.subscriptionBreakdown.premium).toBe(20);
  });

  it('includes pending_content alert when items pending > 30 min', async () => {
    asAdmin();
    // 5 pending news items
    mockPrisma.newsItem.count.mockResolvedValue(5);
    // oldest pending was 60 minutes ago
    const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000);
    mockPrisma.newsItem.findFirst.mockResolvedValue({ createdAt: sixtyMinAgo });

    const res = await request(createApp())
      .get('/api/admin/overview')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    const alert = res.body.alerts.find((a: { type: string }) => a.type === 'pending_content');
    expect(alert).toBeDefined();
    expect(alert.severity).toBe('warning');
    expect(alert.actionUrl).toBe('/admin/moderation');
  });

  it('includes pending_content alert immediately when items pending < 30 min (W1)', async () => {
    asAdmin();
    // 1 pending news item that arrived just 5 minutes ago (< 30 min)
    mockPrisma.newsItem.count.mockResolvedValue(1);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    mockPrisma.newsItem.findFirst.mockResolvedValue({ createdAt: fiveMinAgo });

    const res = await request(createApp())
      .get('/api/admin/overview')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    const alert = res.body.alerts.find((a: { type: string }) => a.type === 'pending_content');
    expect(alert).toBeDefined();
    expect(alert.severity).toBe('warning');
    expect(alert.actionUrl).toBe('/admin/moderation');
  });

  it('does not emit pending_content warning when > 50 items (only critical)', async () => {
    asAdmin();
    mockPrisma.newsItem.count.mockResolvedValue(51);

    const res = await request(createApp())
      .get('/api/admin/overview')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    const warningAlert = res.body.alerts.find((a: { type: string }) => a.type === 'pending_content');
    const criticalAlert = res.body.alerts.find((a: { type: string }) => a.type === 'pending_content_critical');
    expect(warningAlert).toBeUndefined();
    expect(criticalAlert).toBeDefined();
  });

  it('includes pending_content_critical alert when > 50 items pending', async () => {
    asAdmin();
    // Only mock the count — findFirst is not reached when pendingTotal > 50
    mockPrisma.newsItem.count.mockResolvedValue(51);

    const res = await request(createApp())
      .get('/api/admin/overview')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    const alert = res.body.alerts.find((a: { type: string }) => a.type === 'pending_content_critical');
    expect(alert).toBeDefined();
    expect(alert.severity).toBe('error');
  });

  it('includes stale_rss alert when a source has not synced in > 6 hours (W2)', async () => {
    asAdmin();
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
    mockPrisma.rssSource.findMany.mockResolvedValue([
      { name: 'BBC Sport', lastSyncedAt: eightHoursAgo },
    ]);

    const res = await request(createApp())
      .get('/api/admin/overview')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    const alert = res.body.alerts.find((a: { type: string }) => a.type === 'stale_rss');
    expect(alert).toBeDefined();
    expect(alert.severity).toBe('warning');
  });

  it('returns empty alerts array when everything is healthy', async () => {
    asAdmin();
    const res = await request(createApp())
      .get('/api/admin/overview')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body.alerts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/activity-chart
// ---------------------------------------------------------------------------
describe('GET /api/admin/analytics/activity-chart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/analytics/activity-chart');
    expect(res.status).toBe(401);
  });

  it('returns 403 for child role', async () => {
    asChild();
    const res = await request(createApp())
      .get('/api/admin/analytics/activity-chart')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns 200 with an array (empty if no data)', async () => {
    asAdmin();
    const res = await request(createApp())
      .get('/api/admin/analytics/activity-chart')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('transforms raw query rows into chart-friendly objects', async () => {
    asAdmin();
    const date = new Date('2026-04-01T00:00:00.000Z');
    mockPrisma.$queryRaw.mockResolvedValue([
      { date, type: 'news_viewed', count: BigInt(10) },
      { date, type: 'reels_viewed', count: BigInt(5) },
      { date, type: 'quizzes_played', count: BigInt(3) },
    ]);

    const res = await request(createApp())
      .get('/api/admin/analytics/activity-chart')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].date).toBe('2026-04-01');
    expect(res.body[0].newsViewed).toBe(10);
    expect(res.body[0].reelsViewed).toBe(5);
    expect(res.body[0].quizzesPlayed).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/jobs
// ---------------------------------------------------------------------------
describe('GET /api/admin/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.jobRun.findMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/jobs');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp()).get('/api/admin/jobs').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns 10 jobs with statusLabel NEVER when no runs', async () => {
    asAdmin();
    mockPrisma.jobRun.findMany.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/admin/jobs').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(11);
    expect(res.body.jobs.every((j: { statusLabel: string }) => j.statusLabel === 'NEVER')).toBe(true);
  });

  it('returns statusLabel OK for recent successful run', async () => {
    asAdmin();
    mockPrisma.jobRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        jobName: 'sync-feeds',
        startedAt: new Date(),
        finishedAt: new Date(),
        status: 'success',
        triggeredBy: 'cron',
        triggeredId: null,
        output: { processed: 5, errors: 0 },
      },
    ]);
    const res = await request(createApp()).get('/api/admin/jobs').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    const syncJob = res.body.jobs.find((j: { name: string }) => j.name === 'sync-feeds');
    expect(syncJob.statusLabel).toBe('OK');
  });

  it('returns statusLabel STALE for old run', async () => {
    asAdmin();
    const oldTime = new Date(Date.now() - 130 * 60 * 1000); // 130 min ago, 2× the 60min freq + margin
    mockPrisma.jobRun.findMany.mockResolvedValue([
      {
        id: 'run-2',
        jobName: 'sync-feeds',
        startedAt: oldTime,
        finishedAt: oldTime,
        status: 'success',
        triggeredBy: 'cron',
        triggeredId: null,
        output: null,
      },
    ]);
    const res = await request(createApp()).get('/api/admin/jobs').set('Authorization', 'Bearer tok');
    const syncJob = res.body.jobs.find((j: { name: string }) => j.name === 'sync-feeds');
    expect(syncJob.statusLabel).toBe('STALE');
    expect(syncJob.isStale).toBe(true);
  });

  it('returns statusLabel RUNNING when last run is still running', async () => {
    asAdmin();
    mockPrisma.jobRun.findMany.mockResolvedValue([
      {
        id: 'run-3',
        jobName: 'live-scores',
        startedAt: new Date(),
        finishedAt: null,
        status: 'running',
        triggeredBy: 'cron',
        triggeredId: null,
        output: null,
      },
    ]);
    const res = await request(createApp()).get('/api/admin/jobs').set('Authorization', 'Bearer tok');
    const liveJob = res.body.jobs.find((j: { name: string }) => j.name === 'live-scores');
    expect(liveJob.statusLabel).toBe('RUNNING');
  });

  it('returns statusLabel ERROR when last run has status error', async () => {
    asAdmin();
    const recentTime = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
    mockPrisma.jobRun.findMany.mockResolvedValue([
      {
        id: 'run-err',
        jobName: 'sync-feeds',
        startedAt: recentTime,
        finishedAt: recentTime,
        status: 'error',
        triggeredBy: 'cron',
        triggeredId: null,
        output: { error: 'Connection timeout' },
      },
    ]);
    const res = await request(createApp()).get('/api/admin/jobs').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    const syncJob = res.body.jobs.find((j: { name: string }) => j.name === 'sync-feeds');
    expect(syncJob.statusLabel).toBe('ERROR');
    expect(syncJob.isStale).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/jobs/:name/trigger
// ---------------------------------------------------------------------------
describe('POST /api/admin/jobs/:name/trigger', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).post('/api/admin/jobs/sync-feeds/trigger');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp()).post('/api/admin/jobs/sync-feeds/trigger').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown job', async () => {
    asAdmin();
    const res = await request(createApp()).post('/api/admin/jobs/unknown-job/trigger').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(404);
  });

  it('returns 202 with jobRunId for known job', async () => {
    asAdmin();
    mockTriggerJob.mockResolvedValue({ jobRunId: 'run-abc' });
    const res = await request(createApp()).post('/api/admin/jobs/sync-feeds/trigger').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(202);
    expect(res.body.jobRunId).toBe('run-abc');
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/jobs/:name/history
// ---------------------------------------------------------------------------
describe('GET /api/admin/jobs/:name/history', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/jobs/sync-feeds/history');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp()).get('/api/admin/jobs/sync-feeds/history').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown job', async () => {
    asAdmin();
    const res = await request(createApp()).get('/api/admin/jobs/unknown-job/history').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(404);
  });

  it('returns history with correct shape', async () => {
    asAdmin();
    const now = new Date();
    const earlier = new Date(now.getTime() - 5000);
    mockPrisma.jobRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        jobName: 'sync-feeds',
        startedAt: earlier,
        finishedAt: now,
        status: 'success',
        triggeredBy: 'cron',
        triggeredId: null,
        output: { processed: 10 },
      },
    ]);
    const res = await request(createApp()).get('/api/admin/jobs/sync-feeds/history').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body.jobName).toBe('sync-feeds');
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].durationMs).toBe(5000);
    expect(res.body.history[0].status).toBe('success');
  });

  it('respects ?limit param (max 50)', async () => {
    asAdmin();
    mockPrisma.jobRun.findMany.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/admin/jobs/sync-feeds/history?limit=5').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(mockPrisma.jobRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });
});

// ---------------------------------------------------------------------------
// Admin Source Management
// ---------------------------------------------------------------------------

describe('Admin Source Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── RSS Sources ───────────────────────────────────────────────────────────

  describe('GET /api/admin/sources/rss', () => {
    it('returns 401 without auth', async () => {
      noAuth();
      const res = await request(createApp()).get('/api/admin/sources/rss');
      expect(res.status).toBe(401);
    });

    it('returns 403 without admin role', async () => {
      asChild();
      const res = await request(createApp())
        .get('/api/admin/sources/rss')
        .set('Authorization', 'Bearer tok');
      expect(res.status).toBe(403);
    });

    it('returns paginated sources with newsCount and isStale', async () => {
      asAdmin();
      const staleDate = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3h ago
      const freshDate = new Date(Date.now() - 30 * 60 * 1000); // 30min ago
      mockPrisma.rssSource.findMany.mockResolvedValue([
        { id: 'src1', name: 'BBC Sport', url: 'https://bbc.com/rss', sport: 'football', active: true, lastSyncedAt: staleDate, country: 'GB', isCustom: false },
        { id: 'src2', name: 'AS', url: 'https://as.com/rss', sport: 'football', active: true, lastSyncedAt: freshDate, country: 'ES', isCustom: false },
      ]);
      mockPrisma.rssSource.count.mockResolvedValue(2);
      mockPrisma.newsItem.count.mockResolvedValueOnce(10).mockResolvedValueOnce(5);

      const res = await request(createApp())
        .get('/api/admin/sources/rss')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.sources).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.sources[0].newsCount).toBe(10);
      expect(res.body.sources[0].isStale).toBe(true);
      expect(res.body.sources[1].newsCount).toBe(5);
      expect(res.body.sources[1].isStale).toBe(false);
    });

    it('filters by sport', async () => {
      asAdmin();
      mockPrisma.rssSource.findMany.mockResolvedValue([]);
      mockPrisma.rssSource.count.mockResolvedValue(0);

      await request(createApp())
        .get('/api/admin/sources/rss?sport=football')
        .set('Authorization', 'Bearer tok');

      expect(mockPrisma.rssSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ sport: 'football' }) }),
      );
    });

    it('filters by active=true', async () => {
      asAdmin();
      mockPrisma.rssSource.findMany.mockResolvedValue([]);
      mockPrisma.rssSource.count.mockResolvedValue(0);

      await request(createApp())
        .get('/api/admin/sources/rss?active=true')
        .set('Authorization', 'Bearer tok');

      expect(mockPrisma.rssSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ active: true }) }),
      );
    });

    it('filters by active=false', async () => {
      asAdmin();
      mockPrisma.rssSource.findMany.mockResolvedValue([]);
      mockPrisma.rssSource.count.mockResolvedValue(0);

      await request(createApp())
        .get('/api/admin/sources/rss?active=false')
        .set('Authorization', 'Bearer tok');

      expect(mockPrisma.rssSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ active: false }) }),
      );
    });
  });

  describe('PATCH /api/admin/sources/rss/:id', () => {
    it('toggles active field', async () => {
      asAdmin();
      mockPrisma.rssSource.update.mockResolvedValue({
        id: 'src1', name: 'BBC Sport', active: false,
      });

      const res = await request(createApp())
        .patch('/api/admin/sources/rss/src1')
        .set('Authorization', 'Bearer tok')
        .send({ active: false });

      expect(res.status).toBe(200);
      expect(mockPrisma.rssSource.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'src1' }, data: expect.objectContaining({ active: false }) }),
      );
    });

    it('returns 401 without auth', async () => {
      noAuth();
      const res = await request(createApp()).patch('/api/admin/sources/rss/src1').send({ active: false });
      expect(res.status).toBe(401);
    });

    it('returns 403 without admin role', async () => {
      asChild();
      const res = await request(createApp())
        .patch('/api/admin/sources/rss/src1')
        .set('Authorization', 'Bearer tok')
        .send({ active: false });
      expect(res.status).toBe(403);
    });

    it('returns 404 when source not found (P2025)', async () => {
      asAdmin();
      mockPrisma.rssSource.update.mockRejectedValue({ code: 'P2025' });

      const res = await request(createApp())
        .patch('/api/admin/sources/rss/nonexistent')
        .set('Authorization', 'Bearer tok')
        .send({ active: false });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Source not found');
    });
  });

  describe('DELETE /api/admin/sources/rss/:id', () => {
    it('returns 401 without auth', async () => {
      noAuth();
      const res = await request(createApp()).delete('/api/admin/sources/rss/src1');
      expect(res.status).toBe(401);
    });

    it('returns 403 without admin role', async () => {
      asChild();
      const res = await request(createApp())
        .delete('/api/admin/sources/rss/src1')
        .set('Authorization', 'Bearer tok');
      expect(res.status).toBe(403);
    });

    it('returns 403 for predefined source (isCustom: false)', async () => {
      asAdmin();
      mockPrisma.rssSource.findUnique.mockResolvedValue({
        id: 'src1', name: 'BBC Sport', isCustom: false,
      });

      const res = await request(createApp())
        .delete('/api/admin/sources/rss/src1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });

    it('deletes custom source', async () => {
      asAdmin();
      mockPrisma.rssSource.findUnique.mockResolvedValue({
        id: 'src2', name: 'My Custom Feed', isCustom: true,
      });
      mockPrisma.rssSource.delete.mockResolvedValue({ id: 'src2' });

      const res = await request(createApp())
        .delete('/api/admin/sources/rss/src2')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockPrisma.rssSource.delete).toHaveBeenCalledWith({ where: { id: 'src2' } });
    });
  });

  describe('POST /api/admin/sources/rss/:id/sync', () => {
    it('returns { processed, errors } (mocked syncSingleSource)', async () => {
      asAdmin();
      mockSyncSingleSource.mockResolvedValue({ processed: 5, errors: 1 });

      const res = await request(createApp())
        .post('/api/admin/sources/rss/src1/sync')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(5);
      expect(res.body.errors).toBe(1);
    });

    it('returns 401 without auth', async () => {
      noAuth();
      const res = await request(createApp()).post('/api/admin/sources/rss/src1/sync');
      expect(res.status).toBe(401);
    });

    it('returns 403 without admin role', async () => {
      asChild();
      const res = await request(createApp())
        .post('/api/admin/sources/rss/src1/sync')
        .set('Authorization', 'Bearer tok');
      expect(res.status).toBe(403);
    });

    it('returns 500 when syncSingleSource throws', async () => {
      asAdmin();
      mockSyncSingleSource.mockRejectedValue(new Error('Source not found'));
      const res = await request(createApp())
        .post('/api/admin/sources/rss/nonexistent/sync')
        .set('Authorization', 'Bearer tok');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/admin/sources/rss', () => {
    it('returns 401 without auth', async () => {
      noAuth();
      const res = await request(createApp()).post('/api/admin/sources/rss').send({ name: 'My Feed', url: 'https://example.com/rss', sport: 'football', country: 'ES' });
      expect(res.status).toBe(401);
    });

    it('returns 403 without admin role', async () => {
      asChild();
      const res = await request(createApp())
        .post('/api/admin/sources/rss')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'My Feed', url: 'https://example.com/rss', sport: 'football', country: 'ES' });
      expect(res.status).toBe(403);
    });

    it('returns 422 for invalid/unreachable RSS URL', async () => {
      asAdmin();
      mockParseURL.mockRejectedValue(new Error('Connection refused'));

      const res = await request(createApp())
        .post('/api/admin/sources/rss')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'My Feed', url: 'https://example.com/rss', sport: 'football', country: 'ES' });

      expect(res.status).toBe(422);
    });

    it('creates source with isCustom: true for valid URL', async () => {
      asAdmin();
      mockParseURL.mockResolvedValue({ items: [] });
      mockPrisma.rssSource.create.mockResolvedValue({
        id: 'new-src', name: 'My Feed', url: 'https://example.com/rss', sport: 'football', country: 'ES', isCustom: true, active: true,
      });

      const res = await request(createApp())
        .post('/api/admin/sources/rss')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'My Feed', url: 'https://example.com/rss', sport: 'football', country: 'ES' });

      expect(res.status).toBe(201);
      expect(res.body.isCustom).toBe(true);
      expect(mockPrisma.rssSource.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isCustom: true, active: true }) }),
      );
    });
  });

  // ── Video Sources ─────────────────────────────────────────────────────────

  describe('GET /api/admin/sources/video', () => {
    it('returns paginated sources with reelCount and isStale', async () => {
      asAdmin();
      const staleDate = new Date(Date.now() - 10 * 60 * 60 * 1000); // 10h ago
      const freshDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1h ago
      mockPrisma.videoSource.findMany.mockResolvedValue([
        { id: 'vs1', name: 'Barça TV', platform: 'youtube_channel', sport: 'football', active: true, lastSyncedAt: staleDate, isCustom: false },
        { id: 'vs2', name: 'Tennis World', platform: 'youtube_channel', sport: 'tennis', active: true, lastSyncedAt: freshDate, isCustom: false },
      ]);
      mockPrisma.videoSource.count.mockResolvedValue(2);
      mockPrisma.reel.count.mockResolvedValueOnce(8).mockResolvedValueOnce(3);

      const res = await request(createApp())
        .get('/api/admin/sources/video')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.sources).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.sources[0].reelCount).toBe(8);
      expect(res.body.sources[0].isStale).toBe(true);
      expect(res.body.sources[1].reelCount).toBe(3);
      expect(res.body.sources[1].isStale).toBe(false);
    });
  });

  describe('DELETE /api/admin/sources/video/:id', () => {
    it('returns 401 without auth', async () => {
      noAuth();
      const res = await request(createApp()).delete('/api/admin/sources/video/vs1');
      expect(res.status).toBe(401);
    });

    it('returns 403 without admin role', async () => {
      asChild();
      const res = await request(createApp())
        .delete('/api/admin/sources/video/vs1')
        .set('Authorization', 'Bearer tok');
      expect(res.status).toBe(403);
    });

    it('returns 403 for predefined source (isCustom: false)', async () => {
      asAdmin();
      mockPrisma.videoSource.findUnique.mockResolvedValue({
        id: 'vs1', name: 'Barça TV', isCustom: false,
      });

      const res = await request(createApp())
        .delete('/api/admin/sources/video/vs1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });

    it('deletes custom video source', async () => {
      asAdmin();
      mockPrisma.videoSource.findUnique.mockResolvedValue({
        id: 'vs2', name: 'My Channel', isCustom: true,
      });
      mockPrisma.videoSource.delete.mockResolvedValue({ id: 'vs2' });

      const res = await request(createApp())
        .delete('/api/admin/sources/video/vs2')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockPrisma.videoSource.delete).toHaveBeenCalledWith({ where: { id: 'vs2' } });
    });
  });

  describe('POST /api/admin/sources/video', () => {
    it('returns 401 without auth', async () => {
      noAuth();
      const res = await request(createApp()).post('/api/admin/sources/video').send({
        name: 'My Channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=ABC', sport: 'football', platform: 'youtube_channel',
      });
      expect(res.status).toBe(401);
    });

    it('returns 403 without admin role', async () => {
      asChild();
      const res = await request(createApp())
        .post('/api/admin/sources/video')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'My Channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=ABC', sport: 'football', platform: 'youtube_channel' });
      expect(res.status).toBe(403);
    });

    it('creates custom video source with isCustom: true', async () => {
      asAdmin();
      mockPrisma.videoSource.create.mockResolvedValue({
        id: 'new-vs', name: 'My Channel', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=ABC', platform: 'youtube_channel', sport: 'football', isCustom: true, active: true,
      });

      const res = await request(createApp())
        .post('/api/admin/sources/video')
        .set('Authorization', 'Bearer tok')
        .send({
          name: 'My Channel',
          feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=ABC',
          sport: 'football',
          platform: 'youtube_channel',
        });

      expect(res.status).toBe(201);
      expect(res.body.isCustom).toBe(true);
      expect(mockPrisma.videoSource.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isCustom: true, active: true }) }),
      );
    });
  });

  describe('PATCH /api/admin/sources/video/:id', () => {
    it('returns 401 without auth', async () => {
      noAuth();
      const res = await request(createApp()).patch('/api/admin/sources/video/vs1').send({ active: false });
      expect(res.status).toBe(401);
    });

    it('returns 403 without admin role', async () => {
      asChild();
      const res = await request(createApp())
        .patch('/api/admin/sources/video/vs1')
        .set('Authorization', 'Bearer tok')
        .send({ active: false });
      expect(res.status).toBe(403);
    });

    it('returns 404 when source not found (P2025)', async () => {
      asAdmin();
      mockPrisma.videoSource.update.mockRejectedValue({ code: 'P2025' });

      const res = await request(createApp())
        .patch('/api/admin/sources/video/nonexistent')
        .set('Authorization', 'Bearer tok')
        .send({ active: false });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Source not found');
    });
  });

  describe('POST /api/admin/sources/video/:id/sync', () => {
    it('returns { processed, errors } (mocked syncSingleVideoSource)', async () => {
      asAdmin();
      mockSyncSingleVideoSource.mockResolvedValue({ processed: 4, errors: 0 });

      const res = await request(createApp())
        .post('/api/admin/sources/video/vs1/sync')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(4);
      expect(res.body.errors).toBe(0);
    });

    it('returns 401 without auth', async () => {
      noAuth();
      const res = await request(createApp()).post('/api/admin/sources/video/vs1/sync');
      expect(res.status).toBe(401);
    });

    it('returns 403 without admin role', async () => {
      asChild();
      const res = await request(createApp())
        .post('/api/admin/sources/video/vs1/sync')
        .set('Authorization', 'Bearer tok');
      expect(res.status).toBe(403);
    });

    it('returns 500 when syncSingleVideoSource throws', async () => {
      asAdmin();
      mockSyncSingleVideoSource.mockRejectedValue(new Error('Source not found'));
      const res = await request(createApp())
        .post('/api/admin/sources/video/nonexistent/sync')
        .set('Authorization', 'Bearer tok');
      expect(res.status).toBe(500);
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/snapshot
// ---------------------------------------------------------------------------
describe('GET /api/admin/analytics/snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/analytics/snapshot');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    asChild();
    const res = await request(createApp())
      .get('/api/admin/analytics/snapshot')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns snapshots in date range', async () => {
    asAdmin();
    const snapshotRow = {
      date: new Date('2026-04-04T00:00:00.000Z'),
      metric: 'dau',
      value: { count: 42 },
    };
    mockPrisma.analyticsSnapshot.findMany.mockResolvedValue([snapshotRow]);

    const res = await request(createApp())
      .get('/api/admin/analytics/snapshot?from=2026-04-01&to=2026-04-04')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.snapshots).toHaveLength(1);
    expect(res.body.snapshots[0].metric).toBe('dau');
    expect(res.body.snapshots[0].value).toEqual({ count: 42 });
    expect(res.body.from).toBeDefined();
    expect(res.body.to).toBeDefined();
  });

  it('filters snapshots by metrics param', async () => {
    asAdmin();
    mockPrisma.analyticsSnapshot.findMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get('/api/admin/analytics/snapshot?metrics=dau')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.snapshots).toHaveLength(0);

    const call = mockPrisma.analyticsSnapshot.findMany.mock.calls[0]![0] as {
      where: { metric?: { in: string[] } };
    };
    expect(call.where.metric).toEqual({ in: ['dau'] });
  });

  it('returns 400 for invalid date params', async () => {
    asAdmin();

    const res = await request(createApp())
      .get('/api/admin/analytics/snapshot?from=not-a-date')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid date/);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/top-content
// ---------------------------------------------------------------------------
describe('GET /api/admin/analytics/top-content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/analytics/top-content');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    asChild();
    const res = await request(createApp())
      .get('/api/admin/analytics/top-content')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns items ordered by views', async () => {
    asAdmin();
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        contentId: 'news-1',
        views: BigInt(100),
        title: 'Top News',
        sport: 'football',
        publishedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        contentId: 'news-2',
        views: BigInt(50),
        title: 'Second News',
        sport: 'tennis',
        publishedAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    ]);

    const res = await request(createApp())
      .get('/api/admin/analytics/top-content?limit=10')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].contentId).toBe('news-1');
    expect(res.body.items[0].views).toBe(100);
    expect(res.body.items[0].title).toBe('Top News');
    expect(res.body.items[1].views).toBe(50);
  });

  it('returns empty items array when no data', async () => {
    asAdmin();
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const res = await request(createApp())
      .get('/api/admin/analytics/top-content')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------
describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp())
      .get('/api/admin/users')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns paginated users list', async () => {
    asAdmin();
    const fakeUser = {
      id: 'u1',
      email: 'test@example.com',
      role: 'child',
      subscriptionTier: 'free',
      authProvider: 'email',
      country: 'ES',
      locale: 'es',
      createdAt: new Date('2026-01-01'),
      lastLoginAt: null,
      organizationId: null,
      organizationRole: null,
    };
    mockPrisma.user.findMany.mockResolvedValue([fakeUser]);
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await request(createApp())
      .get('/api/admin/users')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].id).toBe('u1');
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
  });

  it('filters users by role', async () => {
    asAdmin();
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    const res = await request(createApp())
      .get('/api/admin/users?role=parent')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    const call = mockPrisma.user.findMany.mock.calls[0]![0] as { where: { role?: string } };
    expect(call.where.role).toBe('parent');
  });

  it('filters users by tier', async () => {
    asAdmin();
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    const res = await request(createApp())
      .get('/api/admin/users?tier=premium')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    const call = mockPrisma.user.findMany.mock.calls[0]![0] as { where: { subscriptionTier?: string } };
    expect(call.where.subscriptionTier).toBe('premium');
  });

  it('searches users by email/id (q param)', async () => {
    asAdmin();
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    const res = await request(createApp())
      .get('/api/admin/users?q=test')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    const call = mockPrisma.user.findMany.mock.calls[0]![0] as { where: { OR?: unknown[] } };
    expect(call.where.OR).toBeDefined();
    expect(Array.isArray(call.where.OR)).toBe(true);
  });

  it('caps limit at 100', async () => {
    asAdmin();
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await request(createApp())
      .get('/api/admin/users?limit=999')
      .set('Authorization', 'Bearer tok');

    const call = mockPrisma.user.findMany.mock.calls[0]![0] as { take: number };
    expect(call.take).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/users/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/users/u1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp())
      .get('/api/admin/users/u1')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns 404 when user not found', async () => {
    asAdmin();
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .get('/api/admin/users/nonexistent')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('returns full user profile with stats', async () => {
    asAdmin();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      name: 'Kid',
      email: 'kid@example.com',
      age: 10,
      role: 'child',
      authProvider: 'email',
      country: 'ES',
      locale: 'es',
      subscriptionTier: 'free',
      subscriptionExpiry: null,
      currentStreak: 3,
      longestStreak: 7,
      totalPoints: 100,
      createdAt: new Date('2026-01-01'),
      lastLoginAt: new Date('2026-04-01'),
      organizationId: null,
      organizationRole: null,
      ageGateCompleted: true,
      consentGiven: true,
      consentDate: null,
      parentalProfile: {
        allowedSports: ['football'],
        allowedFormats: ['news'],
        maxNewsMinutes: 30,
        // allowedHoursStart=0, allowedHoursEnd=24 → scheduleLocked=false (unrestricted hours)
        allowedHoursStart: 0,
        allowedHoursEnd: 24,
        pin: 'hashed',
      },
    });
    mockPrisma.activityLog.findMany.mockResolvedValue([]);
    mockPrisma.activityLog.count.mockResolvedValue(5);
    mockPrisma.userSticker.count.mockResolvedValue(10);
    mockPrisma.userAchievement.count.mockResolvedValue(3);
    mockPrisma.userQuizHistory.count.mockResolvedValue(25);

    const res = await request(createApp())
      .get('/api/admin/users/u1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('u1');
    expect(res.body.stats.stickerCount).toBe(10);
    expect(res.body.stats.achievementCount).toBe(3);
    expect(res.body.stats.totalQuizAnswers).toBe(25);
    expect(res.body.stats.totalNewsViewed).toBe(5);
    expect(res.body.recentActivity).toEqual([]);
    expect(res.body.parentalProfile.hasPin).toBe(true);
    expect(res.body.parentalProfile.allowedSports).toEqual(['football']);
    // scheduleLocked must be computed from allowedHoursStart/allowedHoursEnd
    expect(res.body.parentalProfile.scheduleLocked).toBe(false);
    // passwordHash must NOT be present
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('returns null parentalProfile when not set', async () => {
    asAdmin();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      name: 'Kid2',
      email: null,
      age: 8,
      role: 'child',
      authProvider: 'anonymous',
      country: 'ES',
      locale: 'es',
      subscriptionTier: 'free',
      subscriptionExpiry: null,
      currentStreak: 0,
      longestStreak: 0,
      totalPoints: 0,
      createdAt: new Date(),
      lastLoginAt: null,
      organizationId: null,
      organizationRole: null,
      ageGateCompleted: false,
      consentGiven: false,
      consentDate: null,
      parentalProfile: null,
    });
    mockPrisma.activityLog.findMany.mockResolvedValue([]);
    mockPrisma.activityLog.count.mockResolvedValue(0);
    mockPrisma.userSticker.count.mockResolvedValue(0);
    mockPrisma.userAchievement.count.mockResolvedValue(0);
    mockPrisma.userQuizHistory.count.mockResolvedValue(0);

    const res = await request(createApp())
      .get('/api/admin/users/u2')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.parentalProfile).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/tier
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/users/:id/tier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).patch('/api/admin/users/u1/tier').send({ tier: 'premium' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp())
      .patch('/api/admin/users/u1/tier')
      .set('Authorization', 'Bearer tok')
      .send({ tier: 'premium' });
    expect(res.status).toBe(403);
  });

  it('updates user subscription tier', async () => {
    asAdmin();
    mockPrisma.user.update.mockResolvedValue({ id: 'u1', subscriptionTier: 'premium' });

    const res = await request(createApp())
      .patch('/api/admin/users/u1/tier')
      .set('Authorization', 'Bearer tok')
      .send({ tier: 'premium' });

    expect(res.status).toBe(200);
    expect(res.body.subscriptionTier).toBe('premium');
  });

  it('returns 400 for invalid tier', async () => {
    asAdmin();
    const res = await request(createApp())
      .patch('/api/admin/users/u1/tier')
      .set('Authorization', 'Bearer tok')
      .send({ tier: 'gold' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found (P2025)', async () => {
    asAdmin();
    mockPrisma.user.update.mockRejectedValue({ code: 'P2025' });

    const res = await request(createApp())
      .patch('/api/admin/users/nonexistent/tier')
      .set('Authorization', 'Bearer tok')
      .send({ tier: 'free' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/role
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/users/:id/role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).patch('/api/admin/users/u1/role').send({ role: 'admin' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp())
      .patch('/api/admin/users/u1/role')
      .set('Authorization', 'Bearer tok')
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('returns 403 when changing own role', async () => {
    asAdmin(); // sets userId to 'admin-1'
    const res = await request(createApp())
      .patch('/api/admin/users/admin-1/role')
      .set('Authorization', 'Bearer tok')
      .send({ role: 'child' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Cannot change your own role');
  });

  it('updates user role', async () => {
    asAdmin();
    mockPrisma.user.update.mockResolvedValue({ id: 'u1', role: 'parent' });

    const res = await request(createApp())
      .patch('/api/admin/users/u1/role')
      .set('Authorization', 'Bearer tok')
      .send({ role: 'parent' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('parent');
  });

  it('returns 400 for invalid role', async () => {
    asAdmin();
    const res = await request(createApp())
      .patch('/api/admin/users/u1/role')
      .set('Authorization', 'Bearer tok')
      .send({ role: 'superuser' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found (P2025)', async () => {
    asAdmin();
    mockPrisma.user.update.mockRejectedValue({ code: 'P2025' });

    const res = await request(createApp())
      .patch('/api/admin/users/nonexistent/role')
      .set('Authorization', 'Bearer tok')
      .send({ role: 'child' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/revoke-tokens
// ---------------------------------------------------------------------------
describe('POST /api/admin/users/:id/revoke-tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).post('/api/admin/users/u1/revoke-tokens');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp())
      .post('/api/admin/users/u1/revoke-tokens')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('deletes all refresh tokens and returns count', async () => {
    asAdmin();
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

    const res = await request(createApp())
      .post('/api/admin/users/u1/revoke-tokens')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(3);
  });

  it('returns 0 when no tokens exist', async () => {
    asAdmin();
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    const res = await request(createApp())
      .post('/api/admin/users/u1/revoke-tokens')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/organizations
// ---------------------------------------------------------------------------
describe('GET /api/admin/organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/organizations');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp())
      .get('/api/admin/organizations')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns paginated organizations list with memberCount', async () => {
    asAdmin();
    mockPrisma.organization.findMany.mockResolvedValue([
      {
        id: 'org1',
        name: 'Real Madrid Academy',
        slug: 'real-madrid-academy',
        sport: 'football',
        logoUrl: null,
        inviteCode: 'ABC123',
        maxMembers: 100,
        active: true,
        createdAt: new Date('2026-01-01'),
        createdBy: 'u1',
        _count: { members: 47 },
      },
    ]);
    mockPrisma.organization.count.mockResolvedValue(1);

    const res = await request(createApp())
      .get('/api/admin/organizations')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.organizations).toHaveLength(1);
    expect(res.body.organizations[0].memberCount).toBe(47);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
  });

  it('filters organizations by sport', async () => {
    asAdmin();
    mockPrisma.organization.findMany.mockResolvedValue([]);
    mockPrisma.organization.count.mockResolvedValue(0);

    await request(createApp())
      .get('/api/admin/organizations?sport=basketball')
      .set('Authorization', 'Bearer tok');

    const call = mockPrisma.organization.findMany.mock.calls[0]![0] as { where: { sport?: string } };
    expect(call.where.sport).toBe('basketball');
  });

  it('filters organizations by active status', async () => {
    asAdmin();
    mockPrisma.organization.findMany.mockResolvedValue([]);
    mockPrisma.organization.count.mockResolvedValue(0);

    await request(createApp())
      .get('/api/admin/organizations?active=false')
      .set('Authorization', 'Bearer tok');

    const call = mockPrisma.organization.findMany.mock.calls[0]![0] as { where: { active?: boolean } };
    expect(call.where.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/organizations/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/organizations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).get('/api/admin/organizations/org1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp())
      .get('/api/admin/organizations/org1')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('returns 404 when org not found', async () => {
    asAdmin();
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .get('/api/admin/organizations/nonexistent')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Organization not found');
  });

  it('returns org detail with members and activity', async () => {
    asAdmin();
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org1',
      name: 'Soccer Club',
      slug: 'soccer-club',
      sport: 'football',
      logoUrl: null,
      inviteCode: 'XYZ789',
      maxMembers: 50,
      active: true,
      createdAt: new Date('2026-01-01'),
      createdBy: 'u1',
      members: [
        {
          id: 'u2',
          email: 'member@example.com',
          role: 'child',
          organizationRole: 'member',
          subscriptionTier: 'free',
          lastLoginAt: null,
          createdAt: new Date('2026-02-01'),
        },
      ],
    });
    mockPrisma.$queryRaw.mockResolvedValue([
      { date: new Date('2026-04-01'), count: BigInt(5) },
    ]);

    const res = await request(createApp())
      .get('/api/admin/organizations/org1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.organization.id).toBe('org1');
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0].orgRole).toBe('member');
    expect(res.body.memberCount).toBe(1);
    expect(res.body.activitySummary.dailyActivity).toHaveLength(1);
    expect(res.body.activitySummary.dailyActivity[0].count).toBe(5);
    expect(res.body.activitySummary.totalViews).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/organizations/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/organizations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp())
      .patch('/api/admin/organizations/org1')
      .send({ active: false });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp())
      .patch('/api/admin/organizations/org1')
      .set('Authorization', 'Bearer tok')
      .send({ active: false });
    expect(res.status).toBe(403);
  });

  it('updates org active status', async () => {
    asAdmin();
    mockPrisma.organization.update.mockResolvedValue({ id: 'org1', active: false, maxMembers: 100 });

    const res = await request(createApp())
      .patch('/api/admin/organizations/org1')
      .set('Authorization', 'Bearer tok')
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it('returns 400 when maxMembers < current member count', async () => {
    asAdmin();
    mockPrisma.user.count.mockResolvedValue(50);

    const res = await request(createApp())
      .patch('/api/admin/organizations/org1')
      .set('Authorization', 'Bearer tok')
      .send({ maxMembers: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot be less than/);
  });

  it('updates maxMembers when >= member count', async () => {
    asAdmin();
    mockPrisma.user.count.mockResolvedValue(20);
    mockPrisma.organization.update.mockResolvedValue({ id: 'org1', active: true, maxMembers: 150 });

    const res = await request(createApp())
      .patch('/api/admin/organizations/org1')
      .set('Authorization', 'Bearer tok')
      .send({ maxMembers: 150 });

    expect(res.status).toBe(200);
    expect(res.body.maxMembers).toBe(150);
  });

  it('returns 404 when org not found (P2025)', async () => {
    asAdmin();
    mockPrisma.organization.update.mockRejectedValue({ code: 'P2025' });

    const res = await request(createApp())
      .patch('/api/admin/organizations/nonexistent')
      .set('Authorization', 'Bearer tok')
      .send({ active: false });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Organization not found');
  });

  it('returns 400 for invalid body', async () => {
    asAdmin();
    const res = await request(createApp())
      .patch('/api/admin/organizations/org1')
      .set('Authorization', 'Bearer tok')
      .send({ active: 'yes' }); // should be boolean
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/organizations/:id/regenerate-code
// ---------------------------------------------------------------------------
describe('POST /api/admin/organizations/:id/regenerate-code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    noAuth();
    const res = await request(createApp()).post('/api/admin/organizations/org1/regenerate-code');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    asChild();
    const res = await request(createApp())
      .post('/api/admin/organizations/org1/regenerate-code')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('regenerates invite code and returns new code', async () => {
    asAdmin();
    mockPrisma.organization.update.mockResolvedValue({ id: 'org1', inviteCode: 'NEWCDE' });

    const res = await request(createApp())
      .post('/api/admin/organizations/org1/regenerate-code')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.inviteCode).toBe('NEWCDE');
    expect(mockPrisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org1' } }),
    );
  });

  it('returns 404 when org not found (P2025)', async () => {
    asAdmin();
    mockPrisma.organization.update.mockRejectedValue({ code: 'P2025' });

    const res = await request(createApp())
      .post('/api/admin/organizations/org1/regenerate-code')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Organization not found');
  });
});
