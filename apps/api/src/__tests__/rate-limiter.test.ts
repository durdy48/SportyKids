import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

// We test rate limiters by creating fresh instances per test (to reset counters)
function createTestApp(limiterMax: number, path = '/test') {
  const app = express();
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: limiterMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a moment.' },
  });
  app.use(path, limiter);
  app.get(path, (_req, res) => res.json({ ok: true }));
  app.post(path, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('Rate Limiter', () => {
  it('returns 429 after exceeding limit', async () => {
    const app = createTestApp(3);

    // First 3 should succeed
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
    }

    // 4th should be rate limited
    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
  });

  it('rate limit response body has error message', async () => {
    const app = createTestApp(1);

    await request(app).get('/test'); // use up the limit
    const res = await request(app).get('/test');

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too many requests. Please wait a moment.');
  });

  it('rate limit response includes standard headers', async () => {
    const app = createTestApp(5);

    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBe('5');
    expect(res.headers['ratelimit-remaining']).toBe('4');
    expect(res.headers['ratelimit-reset']).toBeTruthy();
  });

  it('different limiter instances count independently', async () => {
    const app = express();

    const limiterA = rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Rate limited A' },
    });

    const limiterB = rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Rate limited B' },
    });

    app.use('/a', limiterA);
    app.use('/b', limiterB);
    app.get('/a', (_req, res) => res.json({ ok: 'a' }));
    app.get('/b', (_req, res) => res.json({ ok: 'b' }));

    // Exhaust limiter A
    await request(app).get('/a');
    await request(app).get('/a');
    const resA = await request(app).get('/a');
    expect(resA.status).toBe(429);

    // Limiter B should still work
    const resB = await request(app).get('/b');
    expect(resB.status).toBe(200);
  });

  it('health endpoint is accessible under default limit', async () => {
    const app = express();
    const limiter = rateLimit({
      windowMs: 60_000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests.' },
    });
    app.use('/api', limiter);
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Rate Limiter Middleware Exports', () => {
  it('exports 5 limiter instances', async () => {
    const { authLimiter, pinLimiter, contentLimiter, syncLimiter, defaultLimiter } = await import('../middleware/rate-limiter');

    expect(typeof authLimiter).toBe('function');
    expect(typeof pinLimiter).toBe('function');
    expect(typeof contentLimiter).toBe('function');
    expect(typeof syncLimiter).toBe('function');
    expect(typeof defaultLimiter).toBe('function');
  });
});
