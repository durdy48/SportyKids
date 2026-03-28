import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockPrisma = vi.hoisted(() => ({
  parentalProfile: { findUnique: vi.fn(), update: vi.fn() },
  parentalSession: { create: vi.fn().mockResolvedValue({ token: 'mock-session-token', expiresAt: new Date(Date.now() + 300000) }), findUnique: vi.fn(), deleteMany: vi.fn() },
  user: { findUnique: vi.fn() },
  newsItem: { findMany: vi.fn() },
  reel: { findMany: vi.fn() },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

// Stub gamification import used by parents router
vi.mock('../services/gamification', () => ({
  awardPointsForActivity: vi.fn().mockResolvedValue({ pointsAwarded: 0, newAchievements: [] }),
}));

// Stub parental-guard import
vi.mock('../middleware/parental-guard', () => ({
  invalidateProfileCache: vi.fn(),
}));

// Stub mission-generator import
vi.mock('../services/mission-generator', () => ({
  checkMissionProgress: vi.fn().mockResolvedValue({ missionUpdated: false, completed: false, mission: null }),
}));

// Stub digest-generator import
vi.mock('../services/digest-generator', () => ({
  generateDigestData: vi.fn(),
  renderDigestHtml: vi.fn(),
  renderDigestPdf: vi.fn(),
}));

// Stub logger import
vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnValue({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) },
  createRequestLogger: vi.fn().mockReturnValue({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

// Stub monitoring import
vi.mock('../services/monitoring', () => ({
  trackEvent: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Stub parental-session service
const mockCreateParentalSession = vi.fn().mockResolvedValue({ sessionToken: 'mock-session-token', expiresAt: new Date(Date.now() + 300000) });
const mockVerifyParentalSession = vi.fn().mockResolvedValue(null);
vi.mock('../services/parental-session', () => ({
  createParentalSession: (...args: unknown[]) => mockCreateParentalSession(...args),
  verifyParentalSession: (...args: unknown[]) => mockVerifyParentalSession(...args),
  cleanupExpiredSessions: vi.fn().mockResolvedValue(0),
}));

import parentRouter from './parents';
import { errorHandler } from '../middleware/error-handler';

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

// ---------------------------------------------------------------------------
// Setup express app for testing
// ---------------------------------------------------------------------------
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { log: typeof mockLog; requestId: string }).log = mockLog;
    (req as express.Request & { requestId: string }).requestId = 'test-req-id';
    next();
  });
  app.use('/api/parents', parentRouter);
  app.use(errorHandler as express.ErrorRequestHandler);
  return app;
}

const SESSION_TOKEN = 'test-session-token';

function mockSessionForUser(userId: string) {
  mockVerifyParentalSession.mockResolvedValue(userId);
}

describe('GET /api/parents/preview/:userId', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns 401 when no parental session is provided', async () => {
    const res = await request(app).get('/api/parents/preview/unknown-user');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('returns 404 when user or profile not found', async () => {
    mockSessionForUser('unknown-user');
    mockPrisma.parentalProfile.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/parents/preview/unknown-user')
      .set('X-Parental-Session', SESSION_TOKEN);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when profile exists but user does not', async () => {
    mockSessionForUser('u1');
    mockPrisma.parentalProfile.findUnique.mockResolvedValue({ userId: 'u1', allowedFormats: [], allowedSports: [] });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/parents/preview/u1')
      .set('X-Parental-Session', SESSION_TOKEN);
    expect(res.status).toBe(404);
  });

  it('returns news and reels when formats are allowed', async () => {
    mockSessionForUser('u1');
    const fakeNews = [
      { id: 'n1', title: 'Goal!', sport: 'football', safetyStatus: 'approved' },
      { id: 'n2', title: 'Match recap', sport: 'football', safetyStatus: 'approved' },
    ];
    const fakeReels = [
      { id: 'r1', title: 'Highlights', sport: 'football' },
    ];

    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'u1',
      allowedFormats: ['news', 'reels', 'quiz'],
      allowedSports: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      favoriteSports: ['football'],
    });
    mockPrisma.newsItem.findMany.mockResolvedValue(fakeNews);
    mockPrisma.reel.findMany.mockResolvedValue(fakeReels);

    const res = await request(app)
      .get('/api/parents/preview/u1')
      .set('X-Parental-Session', SESSION_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.news).toHaveLength(2);
    expect(res.body.reels).toHaveLength(1);
    expect(res.body.quizAvailable).toBe(true);
  });

  it('returns empty news when news format is blocked', async () => {
    mockSessionForUser('u1');
    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'u1',
      allowedFormats: ['reels'],
      allowedSports: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      favoriteSports: [],
    });
    mockPrisma.reel.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/parents/preview/u1')
      .set('X-Parental-Session', SESSION_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.news).toEqual([]);
    expect(mockPrisma.newsItem.findMany).not.toHaveBeenCalled();
  });

  it('returns quizAvailable false when quiz format is blocked', async () => {
    mockSessionForUser('u1');
    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'u1',
      allowedFormats: ['news'],
      allowedSports: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      favoriteSports: [],
    });
    mockPrisma.newsItem.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/parents/preview/u1')
      .set('X-Parental-Session', SESSION_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.quizAvailable).toBe(false);
  });

  it('filters news by allowed sports when configured', async () => {
    mockSessionForUser('u1');
    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'u1',
      allowedFormats: ['news'],
      allowedSports: ['basketball', 'tennis'],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      favoriteSports: ['football'],
    });
    mockPrisma.newsItem.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/parents/preview/u1')
      .set('X-Parental-Session', SESSION_TOKEN);
    expect(res.status).toBe(200);

    // Verify prisma was called with allowedSports filter (not favoriteSports)
    expect(mockPrisma.newsItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          safetyStatus: 'approved',
          sport: { in: ['basketball', 'tennis'] },
        }),
      }),
    );
  });
});
