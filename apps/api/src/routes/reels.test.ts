import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const { mockParseURL, mockPrisma } = vi.hoisted(() => {
  const mockParseURL = vi.fn();
  const mockPrisma = {
    reel: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    videoSource: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };
  return { mockParseURL, mockPrisma };
});

vi.mock('rss-parser', () => {
  class MockParser {
    parseURL = mockParseURL;
  }
  return { default: MockParser };
});

// Default: RSS feed validation succeeds
mockParseURL.mockResolvedValue({ items: [] });

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('../middleware/parental-guard', () => ({
  parentalGuard: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    // Simulate auth: extract userId from body or query, or default to test user
    const userId = (req.body as Record<string, unknown>)?.userId
      || (req.query as Record<string, unknown>)?.userId
      || 'test-user';
    req.auth = { userId };
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../services/cache', () => ({
  withCache: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  CACHE_TTL: { SOURCES: 600000 },
}));

vi.mock('../services/video-aggregator', () => ({
  syncAllVideoSources: vi.fn().mockResolvedValue({
    totalProcessed: 5,
    totalCreated: 3,
    totalApproved: 3,
    totalRejected: 0,
    totalErrors: 0,
    sources: [],
  }),
}));

vi.mock('../utils/url-validator', () => ({
  isPublicUrl: vi.fn().mockReturnValue({ valid: true }),
}));

import express from 'express';
import request from 'supertest';
import { isPublicUrl } from '../utils/url-validator';
import reelsRouter from './reels';

// Build a test app
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reels', reelsRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/reels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only approved reels ordered by publishedAt desc', async () => {
    const mockReels = [
      { id: 'r1', title: 'Reel 1', safetyStatus: 'approved', publishedAt: new Date('2026-03-25') },
      { id: 'r2', title: 'Reel 2', safetyStatus: 'approved', publishedAt: new Date('2026-03-24') },
    ];
    mockPrisma.reel.findMany.mockResolvedValue(mockReels);
    mockPrisma.reel.count.mockResolvedValue(2);

    const app = createApp();
    const res = await request(app).get('/api/reels');

    expect(res.status).toBe(200);
    expect(res.body.reels).toHaveLength(2);
    // Verify the where clause includes safetyStatus filter
    expect(mockPrisma.reel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ safetyStatus: 'approved' }),
        orderBy: { publishedAt: 'desc' },
      }),
    );
  });

  it('filters by sport', async () => {
    mockPrisma.reel.findMany.mockResolvedValue([]);
    mockPrisma.reel.count.mockResolvedValue(0);

    const app = createApp();
    await request(app).get('/api/reels?sport=football');

    expect(mockPrisma.reel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sport: 'football', safetyStatus: 'approved' }),
      }),
    );
  });
});

describe('GET /api/reels/sources/list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns active video sources', async () => {
    const mockSources = [
      { id: 'vs1', name: 'La Liga', platform: 'youtube_channel', sport: 'football', active: true },
    ];
    mockPrisma.videoSource.findMany.mockResolvedValue(mockSources);

    const app = createApp();
    const res = await request(app).get('/api/reels/sources/list');

    expect(res.status).toBe(200);
    expect(res.body.sources).toHaveLength(1);
    expect(mockPrisma.videoSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });
});

describe('GET /api/reels/sources/catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns full catalog with sport counts', async () => {
    const mockSources = [
      { id: 'vs1', name: 'La Liga', platform: 'youtube_channel', sport: 'football', active: true },
      { id: 'vs2', name: 'NBA', platform: 'youtube_channel', sport: 'basketball', active: true },
    ];
    mockPrisma.videoSource.findMany.mockResolvedValue(mockSources);
    mockPrisma.videoSource.count.mockResolvedValue(2);
    mockPrisma.videoSource.groupBy.mockResolvedValue([
      { sport: 'football', _count: { sport: 1 } },
      { sport: 'basketball', _count: { sport: 1 } },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/reels/sources/catalog');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.bySport).toBeDefined();
  });
});

describe('POST /api/reels/sources/custom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a custom video source', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Test' });
    mockPrisma.videoSource.findUnique.mockResolvedValue(null);
    mockPrisma.videoSource.create.mockResolvedValue({
      id: 'vs-new',
      name: 'My Channel',
      feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtest123',
      platform: 'youtube_channel',
      sport: 'football',
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/reels/sources/custom')
      .send({
        name: 'My Channel',
        feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtest123',
        platform: 'youtube_channel',
        sport: 'football',
        userId: 'user-1',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Channel');
  });

  it('rejects duplicate feedUrl', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Test' });
    mockPrisma.videoSource.findUnique.mockResolvedValue({ id: 'vs-existing' });

    const app = createApp();
    const res = await request(app)
      .post('/api/reels/sources/custom')
      .send({
        name: 'Duplicate',
        feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCexisting',
        platform: 'youtube_channel',
        sport: 'football',
        userId: 'user-1',
      });

    expect(res.status).toBe(409);
  });

  it('rejects invalid body', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/reels/sources/custom')
      .send({ name: '' });

    expect(res.status).toBe(400);
  });

  it('rejects private IP URLs (SSRF prevention)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Test' });
    (isPublicUrl as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      valid: false,
      reason: 'Private/internal URLs are not allowed',
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/reels/sources/custom')
      .send({
        name: 'Evil Source',
        feedUrl: 'http://192.168.1.1/rss',
        platform: 'youtube_channel',
        sport: 'football',
        userId: 'user-1',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('rejects invalid RSS feed URL for YouTube sources', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Test' });
    mockParseURL.mockRejectedValueOnce(new Error('Not a valid RSS feed'));

    const app = createApp();
    const res = await request(app)
      .post('/api/reels/sources/custom')
      .send({
        name: 'Bad Feed',
        feedUrl: 'https://example.com/not-rss',
        platform: 'youtube_channel',
        sport: 'football',
        userId: 'user-1',
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/valid RSS feed/i);
  });

  it('rejects invalid platform values', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/reels/sources/custom')
      .send({
        name: 'Test',
        feedUrl: 'https://example.com/feed',
        platform: 'invalid_platform',
        sport: 'football',
        userId: 'user-1',
      });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/reels/sources/custom/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a custom video source', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Test' });
    mockPrisma.videoSource.findUnique.mockResolvedValue({
      id: 'vs-custom',
      isCustom: true,
      addedBy: 'user-1',
    });
    mockPrisma.videoSource.delete.mockResolvedValue({});

    const app = createApp();
    const res = await request(app)
      .delete('/api/reels/sources/custom/vs-custom')
      .send({ userId: 'user-1' });

    expect(res.status).toBe(200);
  });

  it('rejects deleting catalog sources', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Test' });
    mockPrisma.videoSource.findUnique.mockResolvedValue({
      id: 'vs-catalog',
      isCustom: false,
      addedBy: null,
    });

    const app = createApp();
    const res = await request(app)
      .delete('/api/reels/sources/custom/vs-catalog')
      .send({ userId: 'user-1' });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/reels/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers manual video sync', async () => {
    const app = createApp();
    const res = await request(app).post('/api/reels/sync');

    expect(res.status).toBe(200);
    expect(res.body.totalCreated).toBeDefined();
  });
});
