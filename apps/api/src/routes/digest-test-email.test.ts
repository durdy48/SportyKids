import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockPrisma = vi.hoisted(() => ({
  parentalProfile: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  parentalSession: { create: vi.fn().mockResolvedValue({ token: 'mock-session-token', expiresAt: new Date(Date.now() + 300000) }), findUnique: vi.fn(), deleteMany: vi.fn() },
  user: { findUnique: vi.fn() },
  activityLog: { create: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
  newsItem: { findMany: vi.fn() },
  reel: { findMany: vi.fn() },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/gamification', () => ({
  awardPointsForActivity: vi.fn().mockResolvedValue({ pointsAwarded: 0, newAchievements: [] }),
}));

vi.mock('../middleware/parental-guard', () => ({
  invalidateProfileCache: vi.fn(),
}));

vi.mock('../services/mission-generator', () => ({
  checkMissionProgress: vi.fn().mockResolvedValue({ missionUpdated: false, completed: false, mission: null }),
}));

vi.mock('../services/feed-ranker', () => ({
  invalidateBehavioralCache: vi.fn(),
}));

const mockGenerateDigestData = vi.fn();
const mockRenderDigestHtml = vi.fn();
const mockRenderDigestPdf = vi.fn();
vi.mock('../services/digest-generator', () => ({
  generateDigestData: (...args: unknown[]) => mockGenerateDigestData(...args),
  renderDigestHtml: (...args: unknown[]) => mockRenderDigestHtml(...args),
  renderDigestPdf: (...args: unknown[]) => mockRenderDigestPdf(...args),
}));

vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnValue({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) },
  createRequestLogger: vi.fn().mockReturnValue({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../services/monitoring', () => ({
  trackEvent: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const mockVerifyParentalSession = vi.fn().mockResolvedValue(null);
vi.mock('../services/parental-session', () => ({
  createParentalSession: vi.fn().mockResolvedValue({ sessionToken: 'mock-session-token', expiresAt: new Date(Date.now() + 300000) }),
  verifyParentalSession: (...args: unknown[]) => mockVerifyParentalSession(...args),
  cleanupExpiredSessions: vi.fn().mockResolvedValue(0),
}));

import parentRouter from './parents';
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
  app.use('/api/parents', parentRouter);
  app.use(errorHandler as express.ErrorRequestHandler);
  return app;
}

describe('POST /api/parents/digest/:userId/test', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns 401 when no session token', async () => {
    const res = await request(app)
      .post('/api/parents/digest/user1/test')
      .send();

    expect(res.status).toBe(401);
  });

  it('returns 400 when no digest email configured', async () => {
    mockVerifyParentalSession.mockResolvedValue('user1');
    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'user1',
      digestEmail: null,
      digestEnabled: true,
    });

    const res = await request(app)
      .post('/api/parents/digest/user1/test')
      .set('X-Parental-Session', 'valid-token')
      .send();

    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockVerifyParentalSession.mockResolvedValue('user1');
    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'user1',
      digestEmail: 'test@example.com',
      digestEnabled: true,
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/parents/digest/user1/test')
      .set('X-Parental-Session', 'valid-token')
      .send();

    expect(res.status).toBe(404);
  });

  it('returns 429 when rate limited (cooldown active)', async () => {
    // Pre-populate the cache with a cooldown entry
    const { apiCache } = await import('../services/cache');
    await apiCache.set('test-email-cooldown:user1', 'true', 5 * 60_000);

    mockVerifyParentalSession.mockResolvedValue('user1');
    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'user1',
      digestEmail: 'test@example.com',
      digestEnabled: true,
    });

    const res = await request(app)
      .post('/api/parents/digest/user1/test')
      .set('X-Parental-Session', 'valid-token')
      .send();

    expect(res.status).toBe(429);

    // Clean up
    await apiCache.invalidate('test-email-cooldown:user1');
  });
});
