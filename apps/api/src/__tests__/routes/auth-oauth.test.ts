import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock dependencies that auth.ts imports
// ---------------------------------------------------------------------------

vi.mock('../../config/database', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('../../services/auth-service', () => ({
  generateAccessToken: vi.fn(() => 'mock-access'),
  generateRefreshToken: vi.fn(async () => ({ token: 'mock-refresh' })),
  refreshAccessToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  hashPassword: vi.fn(async () => 'hashed'),
  verifyPassword: vi.fn(async () => true),
}));

vi.mock('../../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../utils/format-user', () => ({
  formatUser: (u: Record<string, unknown>) => u,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import authRouter from '../../routes/auth';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

// ---------------------------------------------------------------------------
// OAuth placeholder route tests
// ---------------------------------------------------------------------------

describe('OAuth placeholder routes', () => {
  const oauthRoutes = [
    { method: 'get', path: '/api/auth/google', provider: 'google' },
    { method: 'get', path: '/api/auth/google/callback', provider: 'google' },
    { method: 'get', path: '/api/auth/apple', provider: 'apple' },
    { method: 'get', path: '/api/auth/apple/callback', provider: 'apple' },
  ] as const;

  for (const route of oauthRoutes) {
    it(`${route.method.toUpperCase()} ${route.path} returns 501 with correct JSON`, async () => {
      const app = createApp();
      const res = await request(app)[route.method](route.path);

      expect(res.status).toBe(501);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('provider', route.provider);
      expect(res.body).toHaveProperty('status', 'planned');
      expect(typeof res.body.error).toBe('string');
    });
  }

  it('GET /api/auth/google includes provider name in error message', async () => {
    const app = createApp();
    const res = await request(app).get('/api/auth/google');
    expect(res.body.error).toMatch(/google/i);
  });

  it('GET /api/auth/apple includes provider name in error message', async () => {
    const app = createApp();
    const res = await request(app).get('/api/auth/apple');
    expect(res.body.error).toMatch(/apple/i);
  });
});
