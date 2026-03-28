import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Hoisted mock for Prisma
const mockPrisma = vi.hoisted(() => ({
  contentReport: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  newsItem: {
    findMany: vi.fn(),
  },
  reel: {
    findMany: vi.fn(),
  },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/mission-generator', () => ({
  checkMissionProgress: vi.fn().mockResolvedValue({
    missionUpdated: false,
    completed: false,
    mission: null,
  }),
}));

vi.mock('../services/parental-session', () => ({
  verifyParentalSession: vi.fn().mockResolvedValue('parent-user-id'),
}));

vi.mock('../services/monitoring', () => ({
  captureException: vi.fn(),
}));

import reportRoutes from './reports';
import { errorHandler } from '../middleware/error-handler';

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

// Build a minimal Express app for testing
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { log: typeof mockLog; requestId: string }).log = mockLog;
    (req as express.Request & { requestId: string }).requestId = 'test-req-id';
    next();
  });
  app.use('/api/reports', reportRoutes);
  app.use(errorHandler as express.ErrorRequestHandler);
  return app;
}

describe('reports routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // POST /api/reports
  // -------------------------------------------------------------------------
  describe('POST /api/reports', () => {
    const validBody = {
      userId: 'user-1',
      contentType: 'news',
      contentId: 'news-1',
      reason: 'inappropriate',
    };

    it('creates report successfully', async () => {
      mockPrisma.contentReport.count.mockResolvedValue(0);
      mockPrisma.contentReport.findFirst.mockResolvedValue(null);
      mockPrisma.contentReport.create.mockResolvedValue({
        id: 'report-1',
        ...validBody,
        comment: null,
        status: 'pending',
        reviewedAt: null,
        createdAt: new Date('2026-03-26T12:00:00Z'),
      });

      const res = await request(createApp())
        .post('/api/reports')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('report-1');
      expect(res.body.status).toBe('pending');
      expect(mockPrisma.contentReport.create).toHaveBeenCalledOnce();
    });

    it('rejects when rate limit exceeded (>= 10 in 24h)', async () => {
      mockPrisma.contentReport.count.mockResolvedValue(10);

      const res = await request(createApp())
        .post('/api/reports')
        .send(validBody);

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(mockPrisma.contentReport.create).not.toHaveBeenCalled();
    });

    it('rejects duplicate report (same userId+contentType+contentId)', async () => {
      mockPrisma.contentReport.count.mockResolvedValue(0);
      mockPrisma.contentReport.findFirst.mockResolvedValue({
        id: 'existing-report',
        ...validBody,
      });

      const res = await request(createApp())
        .post('/api/reports')
        .send(validBody);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(mockPrisma.contentReport.create).not.toHaveBeenCalled();
    });

    it('validates input with Zod (invalid reason returns 400)', async () => {
      const res = await request(createApp())
        .post('/api/reports')
        .send({
          userId: 'user-1',
          contentType: 'news',
          contentId: 'news-1',
          reason: 'not_a_valid_reason',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockPrisma.contentReport.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/reports/parent/:userId
  // -------------------------------------------------------------------------
  describe('GET /api/reports/parent/:userId', () => {
    it('returns reports with content titles', async () => {
      const now = new Date('2026-03-26T12:00:00Z');

      mockPrisma.contentReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          userId: 'user-1',
          contentType: 'news',
          contentId: 'news-1',
          reason: 'scary',
          comment: null,
          status: 'pending',
          reviewedAt: null,
          createdAt: now,
        },
        {
          id: 'r2',
          userId: 'user-1',
          contentType: 'reel',
          contentId: 'reel-1',
          reason: 'confusing',
          comment: 'I did not understand',
          status: 'reviewed',
          reviewedAt: now,
          createdAt: now,
        },
      ]);

      mockPrisma.newsItem.findMany.mockResolvedValue([
        { id: 'news-1', title: 'Football news title' },
      ]);
      mockPrisma.reel.findMany.mockResolvedValue([
        { id: 'reel-1', title: 'Cool reel title' },
      ]);

      const res = await request(createApp())
        .get('/api/reports/parent/user-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].contentTitle).toBe('Football news title');
      expect(res.body[1].contentTitle).toBe('Cool reel title');
      expect(res.body[0].reason).toBe('scary');
      expect(res.body[1].comment).toBe('I did not understand');
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/reports/:reportId
  // -------------------------------------------------------------------------
  describe('PUT /api/reports/:reportId', () => {
    it('updates status to reviewed and sets reviewedAt', async () => {
      const now = new Date('2026-03-26T14:00:00Z');

      mockPrisma.contentReport.findUnique.mockResolvedValue({
        id: 'report-1',
        status: 'pending',
      });

      mockPrisma.contentReport.update.mockResolvedValue({
        id: 'report-1',
        status: 'reviewed',
        reviewedAt: now,
      });

      const res = await request(createApp())
        .put('/api/reports/report-1')
        .send({ status: 'reviewed' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('reviewed');
      expect(res.body.reviewedAt).toBeTruthy();
      expect(mockPrisma.contentReport.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: {
          status: 'reviewed',
          reviewedAt: expect.any(Date),
        },
      });
    });

    it('returns 404 for non-existent report', async () => {
      mockPrisma.contentReport.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/reports/non-existent')
        .send({ status: 'dismissed' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
