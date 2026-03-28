import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock dependencies that auth.ts imports
// ---------------------------------------------------------------------------

vi.mock('../../config/database', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('../../services/auth-service', () => ({
  generateAccessToken: vi.fn(() => 'mock-access'),
  generateRefreshToken: vi.fn(async () => ({ token: 'mock-refresh' })),
  refreshAccessToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  hashPassword: vi.fn(async () => 'hashed'),
  verifyPassword: vi.fn(async () => true),
  findOrCreateSocialUser: vi.fn(async () => ({
    user: { id: 'user-1', role: 'parent', parentUserId: null },
    isNewUser: true,
  })),
}));

vi.mock('../../services/passport', () => {
  const mock = {
    use: vi.fn(),
    authenticate: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
    initialize: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  };
  return { default: mock };
});

vi.mock('../../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../utils/format-user', () => ({
  formatUser: (u: Record<string, unknown>) => u,
}));

vi.mock('../../services/monitoring', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('../../services/logger', () => {
  const noop = vi.fn();
  const childLogger = { info: noop, warn: noop, error: noop, debug: noop, child: vi.fn() };
  childLogger.child = vi.fn(() => childLogger);
  return {
    default: childLogger,
    createRequestLogger: vi.fn(() => childLogger),
  };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import authRouter from '../../routes/auth';
import { errorHandler } from '../../middleware/error-handler';
import { requestIdMiddleware } from '../../middleware/request-id';

function createApp() {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// OAuth route tests
// ---------------------------------------------------------------------------

describe('OAuth routes', () => {
  beforeEach(() => {
    // Clear OAuth env vars by default
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.APPLE_CLIENT_ID;
  });

  describe('GET /api/auth/providers', () => {
    it('returns false for both when env vars are not set', async () => {
      const app = createApp();
      const res = await request(app).get('/api/auth/providers');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ google: false, apple: false });
    });

    it('returns true for google when GOOGLE_CLIENT_ID is set', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-google-id';
      const app = createApp();
      const res = await request(app).get('/api/auth/providers');

      expect(res.body.google).toBe(true);
      expect(res.body.apple).toBe(false);
    });

    it('returns true for apple when APPLE_CLIENT_ID is set', async () => {
      process.env.APPLE_CLIENT_ID = 'test-apple-id';
      const app = createApp();
      const res = await request(app).get('/api/auth/providers');

      expect(res.body.apple).toBe(true);
      expect(res.body.google).toBe(false);
    });
  });

  describe('GET /api/auth/google (no env)', () => {
    it('returns 404 when GOOGLE_CLIENT_ID is not set', async () => {
      const app = createApp();
      const res = await request(app).get('/api/auth/google');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/auth/apple (no env)', () => {
    it('returns 404 when APPLE_CLIENT_ID is not set', async () => {
      const app = createApp();
      const res = await request(app).get('/api/auth/apple');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/auth/google/token', () => {
    it('returns 400 when idToken is missing', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-google-id';
      const app = createApp();
      const res = await request(app).post('/api/auth/google/token').send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 when GOOGLE_CLIENT_ID is not set', async () => {
      const app = createApp();
      const res = await request(app).post('/api/auth/google/token').send({ idToken: 'some-token' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/auth/apple/token', () => {
    it('returns 400 when idToken is missing', async () => {
      process.env.APPLE_CLIENT_ID = 'test-apple-id';
      const app = createApp();
      const res = await request(app).post('/api/auth/apple/token').send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 when APPLE_CLIENT_ID is not set', async () => {
      const app = createApp();
      const res = await request(app).post('/api/auth/apple/token').send({ idToken: 'some-token' });

      expect(res.status).toBe(404);
    });

    it('returns 401 for malformed apple token', async () => {
      process.env.APPLE_CLIENT_ID = 'test-apple-id';
      const app = createApp();
      const res = await request(app).post('/api/auth/apple/token').send({ idToken: 'not-a-jwt' });

      expect(res.status).toBe(401);
    });
  });
});
