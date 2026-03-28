import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock prisma
const mockPrisma = vi.hoisted(() => ({
  dailyMission: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findUniqueOrThrow: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  parentalProfile: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/monitoring', () => ({
  trackEvent: vi.fn(),
}));

// Mock gamification
vi.mock('../services/gamification', () => ({
  awardSticker: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import missionsRouter from './missions';
import { errorHandler } from '../middleware/error-handler';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { log: Record<string, unknown> }).log = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as unknown as Record<string, unknown>;
    next();
  });
  app.use('/api/missions', missionsRouter);
  app.use(errorHandler as express.ErrorRequestHandler);
  return app;
}

describe('GET /api/missions/today/:userId', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('wraps mission in { mission } envelope', async () => {
    const mockMission = {
      id: 'm1',
      userId: 'u1',
      date: new Date().toISOString().split('T')[0],
      type: 'read_news',
      title: 'Read 3 news',
      description: 'Read 3 news today',
      target: 3,
      progress: 1,
      completed: false,
      claimed: false,
      rewardType: 'sticker',
      rewardRarity: 'rare',
      rewardPoints: 0,
    };

    mockPrisma.dailyMission.findUnique.mockResolvedValue(mockMission);
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', age: 10, favoriteSports: ['football'] });
    mockPrisma.parentalProfile.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/missions/today/u1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mission');
    expect(res.body.mission.type).toBe('read_news');
  });

  it('returns { mission: null, expired: false } for non-existent user with no history', async () => {
    mockPrisma.dailyMission.findUnique
      .mockResolvedValueOnce(null) // today check in generateDailyMission
      .mockResolvedValueOnce(null); // yesterday check in route handler
    mockPrisma.user.findUniqueOrThrow.mockRejectedValue(Object.assign(new Error('Not found'), { code: 'P2025' }));

    const res = await request(app).get('/api/missions/today/nonexistent');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mission: null, expired: false });
  });
});

describe('POST /api/missions/claim', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns 400 when no completed mission exists', async () => {
    mockPrisma.dailyMission.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/missions/claim')
      .send({ userId: 'u1' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when userId is empty', async () => {
    const res = await request(app)
      .post('/api/missions/claim')
      .send({ userId: '' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/missions/today/:userId — expired mission', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns expired: false when mission is generated successfully', async () => {
    const mockMission = {
      id: 'm2',
      userId: 'u2',
      date: new Date().toISOString().split('T')[0],
      type: 'watch_reels',
      title: 'Watch 2 reels',
      description: 'Watch 2 reels today',
      target: 2,
      progress: 0,
      completed: false,
      claimed: false,
      rewardType: 'sticker',
      rewardRarity: 'rare',
      rewardPoints: 0,
    };

    mockPrisma.dailyMission.findUnique.mockResolvedValue(mockMission);
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u2', age: 10, favoriteSports: ['football'] });
    mockPrisma.parentalProfile.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/missions/today/u2');

    expect(res.status).toBe(200);
    expect(res.body.expired).toBe(false);
    expect(res.body.mission).toBeTruthy();
  });

  it('returns expired: true when user not found but yesterday mission exists', async () => {
    // No mission for today, user findUniqueOrThrow fails
    mockPrisma.dailyMission.findUnique
      .mockResolvedValueOnce(null) // today's mission
      .mockResolvedValueOnce({ id: 'yesterday-m' }); // yesterday's mission

    mockPrisma.user.findUniqueOrThrow.mockRejectedValue(
      Object.assign(new Error('Not found'), { code: 'P2025' }),
    );
    mockPrisma.parentalProfile.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/missions/today/u-gone');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mission: null, expired: true });
  });

  it('returns expired: false when user not found and no yesterday mission', async () => {
    mockPrisma.dailyMission.findUnique
      .mockResolvedValueOnce(null) // today
      .mockResolvedValueOnce(null); // yesterday

    mockPrisma.user.findUniqueOrThrow.mockRejectedValue(
      Object.assign(new Error('Not found'), { code: 'P2025' }),
    );
    mockPrisma.parentalProfile.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/missions/today/new-user');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mission: null, expired: false });
  });
});
