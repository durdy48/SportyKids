import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockPrisma = vi.hoisted(() => ({
  parentalProfile: { findUnique: vi.fn(), update: vi.fn() },
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

import parentRouter from './parents';

// ---------------------------------------------------------------------------
// Setup express app for testing
// ---------------------------------------------------------------------------
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/parents', parentRouter);
  return app;
}

// Helper to obtain a valid parental session token via the verify-pin endpoint
async function getSessionToken(app: express.Express, userId: string): Promise<string> {
  // Mock parentalProfile.findUnique to return a profile with a bcrypt hash of '1234'
  // bcrypt hash of '1234' with 10 rounds (pre-computed for test speed)
  const bcryptHash = '$2b$10$NR/Uj2E5dQfNfXINhA8DnO1UWi/GpEiwgyjlWiQJI4tJCASrlDWYS';
  mockPrisma.parentalProfile.findUnique.mockResolvedValueOnce({
    userId,
    pin: bcryptHash,
    allowedFormats: '[]',
    allowedSports: '[]',
    failedAttempts: 0,
    lockedUntil: null,
  });

  const res = await request(app)
    .post('/api/parents/verify-pin')
    .send({ userId, pin: '1234' });

  return res.body.sessionToken;
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
    expect(res.body.error).toBe('Parental session required');
  });

  it('returns 404 when user or profile not found', async () => {
    const sessionToken = await getSessionToken(app, 'unknown-user');

    mockPrisma.parentalProfile.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/parents/preview/unknown-user')
      .set('X-Parental-Session', sessionToken);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('returns 404 when profile exists but user does not', async () => {
    const sessionToken = await getSessionToken(app, 'u1');

    mockPrisma.parentalProfile.findUnique.mockResolvedValue({ userId: 'u1', allowedFormats: '[]', allowedSports: '[]' });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/parents/preview/u1')
      .set('X-Parental-Session', sessionToken);
    expect(res.status).toBe(404);
  });

  it('returns news and reels when formats are allowed', async () => {
    const sessionToken = await getSessionToken(app, 'u1');

    const fakeNews = [
      { id: 'n1', title: 'Goal!', sport: 'football', safetyStatus: 'approved' },
      { id: 'n2', title: 'Match recap', sport: 'football', safetyStatus: 'approved' },
    ];
    const fakeReels = [
      { id: 'r1', title: 'Highlights', sport: 'football' },
    ];

    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'u1',
      allowedFormats: JSON.stringify(['news', 'reels', 'quiz']),
      allowedSports: '[]',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      favoriteSports: JSON.stringify(['football']),
    });
    mockPrisma.newsItem.findMany.mockResolvedValue(fakeNews);
    mockPrisma.reel.findMany.mockResolvedValue(fakeReels);

    const res = await request(app)
      .get('/api/parents/preview/u1')
      .set('X-Parental-Session', sessionToken);
    expect(res.status).toBe(200);
    expect(res.body.news).toHaveLength(2);
    expect(res.body.reels).toHaveLength(1);
    expect(res.body.quizAvailable).toBe(true);
  });

  it('returns empty news when news format is blocked', async () => {
    const sessionToken = await getSessionToken(app, 'u1');

    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'u1',
      allowedFormats: JSON.stringify(['reels']),
      allowedSports: '[]',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      favoriteSports: '[]',
    });
    mockPrisma.reel.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/parents/preview/u1')
      .set('X-Parental-Session', sessionToken);
    expect(res.status).toBe(200);
    expect(res.body.news).toEqual([]);
    expect(mockPrisma.newsItem.findMany).not.toHaveBeenCalled();
  });

  it('returns quizAvailable false when quiz format is blocked', async () => {
    const sessionToken = await getSessionToken(app, 'u1');

    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'u1',
      allowedFormats: JSON.stringify(['news']),
      allowedSports: '[]',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      favoriteSports: '[]',
    });
    mockPrisma.newsItem.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/parents/preview/u1')
      .set('X-Parental-Session', sessionToken);
    expect(res.status).toBe(200);
    expect(res.body.quizAvailable).toBe(false);
  });

  it('filters news by allowed sports when configured', async () => {
    const sessionToken = await getSessionToken(app, 'u1');

    mockPrisma.parentalProfile.findUnique.mockResolvedValue({
      userId: 'u1',
      allowedFormats: JSON.stringify(['news']),
      allowedSports: JSON.stringify(['basketball', 'tennis']),
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      favoriteSports: JSON.stringify(['football']),
    });
    mockPrisma.newsItem.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/parents/preview/u1')
      .set('X-Parental-Session', sessionToken);
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
