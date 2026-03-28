import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  age: 35,
  email: 'test@example.com',
  authProvider: 'google',
  socialId: 'google-123',
  role: 'parent',
  parentUserId: null,
  passwordHash: null,
  favoriteSports: [],
  selectedFeeds: [],
  totalPoints: 0,
  locale: 'es',
  country: 'ES',
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: new Date(),
};

const mockPrisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

// Functional cache mock that stores OAuth state params for CSRF validation tests
const cacheStore = new Map<string, unknown>();
vi.mock('../services/cache', () => ({
  apiCache: {
    get: vi.fn((key: string) => cacheStore.get(key)),
    set: vi.fn((key: string, value: unknown) => { cacheStore.set(key, value); }),
    invalidate: vi.fn((key: string) => cacheStore.delete(key)),
    invalidatePattern: vi.fn(),
  },
  CACHE_TTL: {},
  CACHE_KEYS: {},
  withCache: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../middleware/parental-guard', () => ({
  parentalGuard: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../services/feed-ranker', () => ({
  rankFeed: vi.fn((items: unknown[]) => items),
  getBehavioralSignals: vi.fn().mockResolvedValue({
    sportEngagement: new Map(),
    sourceEngagement: new Map(),
    readContentIds: new Set(),
  }),
}));

// Mock passport (prevent strategy registration errors)
vi.mock('../services/passport', () => {
  const passportMock = {
    authenticate: vi.fn(),
    use: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
    initialize: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  };
  return { default: passportMock };
});

// Mock logger
vi.mock('../services/logger', () => {
  const noop = vi.fn();
  const childLogger = { info: noop, warn: noop, error: noop, debug: noop, child: vi.fn() };
  childLogger.child = vi.fn(() => childLogger);
  return {
    default: childLogger,
    createRequestLogger: vi.fn(() => childLogger),
  };
});

// Mock monitoring
vi.mock('../services/monitoring', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Mock google-auth-library
const mockVerifyIdToken = vi.fn();
vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: class MockOAuth2Client {
      verifyIdToken = mockVerifyIdToken;
    },
  };
});

// Mock jwks-rsa — prevents real JWKS fetches in tests
vi.mock('jwks-rsa', () => {
  return {
    default: () => ({
      getSigningKey: vi.fn().mockResolvedValue({
        getPublicKey: () => 'mock-public-key',
      }),
    }),
  };
});

// Mock jsonwebtoken.verify for Apple token verification in tests
const mockJwtVerify = vi.fn();
vi.mock('jsonwebtoken', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jsonwebtoken')>();
  return {
    ...actual,
    default: {
      ...actual,
      verify: (...args: unknown[]) => {
        // If the key is our mock key, use our mock; otherwise use real verify
        if (args[1] === 'mock-public-key') {
          return mockJwtVerify(...args);
        }
        return actual.verify(...(args as Parameters<typeof actual.verify>));
      },
      sign: actual.sign,
    },
  };
});

import express from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import { errorHandler } from '../middleware/error-handler';
import { requestIdMiddleware } from '../middleware/request-id';
import { findOrCreateSocialUser, verifyAccessToken } from '../services/auth-service';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Create a fake Apple identity token (JWT format) for testing. */
function createFakeAppleToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use('/api/auth', authRouter);
  app.use(errorHandler as express.ErrorRequestHandler);
  return app;
}

// ---------------------------------------------------------------------------
// findOrCreateSocialUser unit tests
// ---------------------------------------------------------------------------

describe('findOrCreateSocialUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.refreshToken.create.mockResolvedValue({ token: 'rt-1', expiresAt: new Date() });
  });

  it('returns existing user when found by socialId + provider', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue(mockUser);

    const result = await findOrCreateSocialUser('google', 'google-123', 'test@example.com', 'Test User');

    expect(result.isNewUser).toBe(false);
    expect(result.user.id).toBe('user-1');
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { authProvider: 'google', socialId: 'google-123' },
    });
    // Should update lastLoginAt
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it('links existing email account to social provider', async () => {
    const existingEmailUser = { ...mockUser, authProvider: 'email', socialId: null };
    const linkedUser = { ...mockUser, authProvider: 'google', socialId: 'google-456' };

    mockPrisma.user.findFirst.mockResolvedValue(null); // no social match
    mockPrisma.user.findUnique.mockResolvedValue(existingEmailUser); // email match
    mockPrisma.user.update.mockResolvedValue(linkedUser);

    const result = await findOrCreateSocialUser('google', 'google-456', 'test@example.com', 'Test User');

    expect(result.isNewUser).toBe(false);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        socialId: 'google-456',
        authProvider: 'google',
        lastLoginAt: expect.any(Date),
      },
    });
  });

  it('creates new user when no match found', async () => {
    const newUser = { ...mockUser, id: 'user-new', socialId: 'google-789' };
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(newUser);

    const result = await findOrCreateSocialUser('google', 'google-789', 'new@example.com', 'New User');

    expect(result.isNewUser).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'New User',
        age: 35,
        email: 'new@example.com',
        socialId: 'google-789',
        authProvider: 'google',
        role: 'parent',
        lastLoginAt: expect.any(Date),
      },
    });
  });

  it('creates user without email when email is null', async () => {
    const newUser = { ...mockUser, id: 'user-no-email', email: null };
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(newUser);

    const result = await findOrCreateSocialUser('apple', 'apple-123', null, 'Apple User');

    expect(result.isNewUser).toBe(true);
    // Should NOT call findUnique (no email to check)
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: null,
        socialId: 'apple-123',
        authProvider: 'apple',
      }),
    });
  });

  it('defaults name to "User" when empty string provided', async () => {
    const newUser = { ...mockUser, id: 'user-default-name', name: 'User' };
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(newUser);

    await findOrCreateSocialUser('google', 'google-empty', 'e@example.com', '');

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'User' }),
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/providers
// ---------------------------------------------------------------------------

describe('GET /api/auth/providers', () => {
  const app = createApp();

  it('returns false for both when env vars are not set', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.APPLE_CLIENT_ID;

    const res = await request(app).get('/api/auth/providers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ google: false, apple: false });
  });

  it('returns true for google when GOOGLE_CLIENT_ID is set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-id';
    delete process.env.APPLE_CLIENT_ID;

    const res = await request(app).get('/api/auth/providers');
    expect(res.status).toBe(200);
    expect(res.body.google).toBe(true);
    expect(res.body.apple).toBe(false);

    delete process.env.GOOGLE_CLIENT_ID;
  });

  it('returns true for apple when APPLE_CLIENT_ID is set', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    process.env.APPLE_CLIENT_ID = 'test-apple-id';

    const res = await request(app).get('/api/auth/providers');
    expect(res.status).toBe(200);
    expect(res.body.google).toBe(false);
    expect(res.body.apple).toBe(true);

    delete process.env.APPLE_CLIENT_ID;
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/google/token — Mobile Google auth flow
// ---------------------------------------------------------------------------

describe('POST /api/auth/google/token', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.refreshToken.create.mockResolvedValue({ token: 'rt-mock', expiresAt: new Date() });
  });

  it('returns 400 when idToken is missing', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-id';

    const res = await request(app).post('/api/auth/google/token').send({});
    expect(res.status).toBe(400);

    delete process.env.GOOGLE_CLIENT_ID;
  });

  it('returns 404 when Google is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const res = await request(app).post('/api/auth/google/token').send({ idToken: 'some-token' });
    expect(res.status).toBe(404);
  });

  it('returns 401 when Google token verification fails', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-id';
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

    const res = await request(app).post('/api/auth/google/token').send({ idToken: 'invalid-token' });
    expect(res.status).toBe(401);

    delete process.env.GOOGLE_CLIENT_ID;
  });

  it('returns tokens and user on valid Google ID token', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-id';

    const googleUser = { ...mockUser, id: 'google-user-1' };
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-123',
        email: 'google@example.com',
        name: 'Google User',
      }),
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(googleUser);

    const res = await request(app).post('/api/auth/google/token').send({ idToken: 'valid-google-token' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
    // socialId should be stripped from response
    expect(res.body.user).not.toHaveProperty('socialId');
    expect(res.body.user).not.toHaveProperty('passwordHash');

    delete process.env.GOOGLE_CLIENT_ID;
  });

  it('returns valid JWT that works with verifyAccessToken', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-id';

    const googleUser = { ...mockUser, id: 'jwt-test-user', role: 'parent' };
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-jwt-test',
        email: 'jwt@example.com',
        name: 'JWT Test',
      }),
    });
    mockPrisma.user.findFirst.mockResolvedValue(googleUser);
    mockPrisma.user.update.mockResolvedValue(googleUser);

    const res = await request(app).post('/api/auth/google/token').send({ idToken: 'valid-token' });

    expect(res.status).toBe(200);
    const decoded = verifyAccessToken(res.body.accessToken);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe('jwt-test-user');
    expect(decoded!.role).toBe('parent');

    delete process.env.GOOGLE_CLIENT_ID;
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/apple/token — Mobile Apple auth flow
// ---------------------------------------------------------------------------

describe('POST /api/auth/apple/token', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    mockPrisma.refreshToken.create.mockResolvedValue({ token: 'rt-apple', expiresAt: new Date() });
  });

  it('returns 400 when idToken is missing', async () => {
    process.env.APPLE_CLIENT_ID = 'test-apple-id';

    const res = await request(app).post('/api/auth/apple/token').send({});
    expect(res.status).toBe(400);

    delete process.env.APPLE_CLIENT_ID;
  });

  it('returns 404 when Apple is not configured', async () => {
    delete process.env.APPLE_CLIENT_ID;

    const res = await request(app).post('/api/auth/apple/token').send({ idToken: 'some-token' });
    expect(res.status).toBe(404);
  });

  it('returns 401 for malformed token (not a valid JWT)', async () => {
    process.env.APPLE_CLIENT_ID = 'test-apple-id';
    mockJwtVerify.mockImplementation(() => { throw new Error('Invalid token'); });

    const res = await request(app).post('/api/auth/apple/token').send({ idToken: 'not-a-jwt' });
    expect(res.status).toBe(401);

    delete process.env.APPLE_CLIENT_ID;
  });

  it('returns 401 when token payload has no sub', async () => {
    process.env.APPLE_CLIENT_ID = 'test-apple-id';

    const token = createFakeAppleToken({ email: 'no-sub@example.com' });
    mockJwtVerify.mockReturnValue({ email: 'no-sub@example.com', iss: 'https://appleid.apple.com', aud: 'test-apple-id' });

    const res = await request(app).post('/api/auth/apple/token').send({ idToken: token });
    expect(res.status).toBe(401);

    delete process.env.APPLE_CLIENT_ID;
  });

  it('returns tokens and user on valid Apple identity token', async () => {
    process.env.APPLE_CLIENT_ID = 'test-apple-id';

    const appleUser = { ...mockUser, id: 'apple-user-1', authProvider: 'apple', socialId: 'apple-sub-123' };
    const token = createFakeAppleToken({ sub: 'apple-sub-123', email: 'apple@example.com' });

    mockJwtVerify.mockReturnValue({ sub: 'apple-sub-123', email: 'apple@example.com', iss: 'https://appleid.apple.com', aud: 'test-apple-id' });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(appleUser);

    const res = await request(app).post('/api/auth/apple/token').send({ idToken: token, name: 'Apple User' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).not.toHaveProperty('socialId');

    delete process.env.APPLE_CLIENT_ID;
  });

  it('uses provided name for new Apple user', async () => {
    process.env.APPLE_CLIENT_ID = 'test-apple-id';

    const appleUser = { ...mockUser, id: 'apple-named', name: 'John Doe' };
    const token = createFakeAppleToken({ sub: 'apple-sub-named', email: 'john@example.com' });

    mockJwtVerify.mockReturnValue({ sub: 'apple-sub-named', email: 'john@example.com', iss: 'https://appleid.apple.com', aud: 'test-apple-id' });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(appleUser);

    await request(app).post('/api/auth/apple/token').send({ idToken: token, name: 'John Doe' });

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'John Doe' }),
    });

    delete process.env.APPLE_CLIENT_ID;
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/apple/callback — Apple form POST callback
// ---------------------------------------------------------------------------

describe('POST /api/auth/apple/callback', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    mockPrisma.refreshToken.create.mockResolvedValue({ token: 'rt-cb', expiresAt: new Date() });
  });

  /** Pre-populate the cache with a valid OAuth state, simulating GET /apple flow. */
  function seedOAuthState(state: string, nonceHash = 'test-nonce-hash') {
    cacheStore.set(`oauth:state:${state}`, { valid: true, nonceHash });
  }

  it('redirects to login with error when id_token is missing', async () => {
    const res = await request(app)
      .post('/api/auth/apple/callback')
      .type('form')
      .send({});

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login?error=apple_auth_failed');
  });

  it('redirects to login with error when state is invalid', async () => {
    const token = createFakeAppleToken({ sub: 'apple-no-state', email: 'nostate@example.com' });

    const res = await request(app)
      .post('/api/auth/apple/callback')
      .type('form')
      .send({ id_token: token, state: 'invalid-state' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login?error=invalid_state');
  });

  it('redirects with tokens on valid Apple callback', async () => {
    const validState = 'valid-state-abc';
    const nonceHash = 'test-nonce-hash';
    seedOAuthState(validState, nonceHash);

    const appleUser = { ...mockUser, id: 'apple-cb-user', authProvider: 'apple' };
    const token = createFakeAppleToken({ sub: 'apple-cb-sub', email: 'cb@example.com' });

    mockJwtVerify.mockReturnValue({
      sub: 'apple-cb-sub',
      email: 'cb@example.com',
      nonce: nonceHash,
      iss: 'https://appleid.apple.com',
      aud: 'test-apple-id',
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(appleUser);

    const res = await request(app)
      .post('/api/auth/apple/callback')
      .type('form')
      .send({ id_token: token, state: validState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/callback?token=');
    expect(res.headers.location).toContain('&refresh=');
  });

  it('parses Apple user JSON for first-time name', async () => {
    const validState = 'valid-state-name';
    const nonceHash = 'name-nonce-hash';
    seedOAuthState(validState, nonceHash);

    const appleUser = { ...mockUser, id: 'apple-name-cb', name: 'Jane Smith' };
    const token = createFakeAppleToken({ sub: 'apple-name-sub', email: 'jane@example.com' });
    const appleUserData = JSON.stringify({ name: { firstName: 'Jane', lastName: 'Smith' } });

    mockJwtVerify.mockReturnValue({
      sub: 'apple-name-sub',
      email: 'jane@example.com',
      nonce: nonceHash,
      iss: 'https://appleid.apple.com',
      aud: 'test-apple-id',
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(appleUser);

    await request(app)
      .post('/api/auth/apple/callback')
      .type('form')
      .send({ id_token: token, state: validState, user: appleUserData });

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Jane Smith' }),
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/google — Redirect (without configured strategy)
// ---------------------------------------------------------------------------

describe('GET /api/auth/google', () => {
  const app = createApp();

  it('returns 404 when GOOGLE_CLIENT_ID is not set', async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/apple — Redirect
// ---------------------------------------------------------------------------

describe('GET /api/auth/apple', () => {
  const app = createApp();

  it('returns 404 when APPLE_CLIENT_ID is not set', async () => {
    delete process.env.APPLE_CLIENT_ID;

    const res = await request(app).get('/api/auth/apple');
    expect(res.status).toBe(404);
  });

  it('redirects to Apple authorization when configured', async () => {
    process.env.APPLE_CLIENT_ID = 'test-apple-client';

    const res = await request(app).get('/api/auth/apple');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('https://appleid.apple.com/auth/authorize');
    expect(res.headers.location).toContain('client_id=test-apple-client');

    delete process.env.APPLE_CLIENT_ID;
  });
});

// ---------------------------------------------------------------------------
// formatUser strips socialId
// ---------------------------------------------------------------------------

describe('formatUser strips sensitive fields', () => {
  it('removes socialId and passwordHash from user object', async () => {
    const { formatUser } = await import('../utils/format-user');
    const user = {
      id: 'u1',
      name: 'Test',
      passwordHash: 'secret',
      socialId: 'social-secret',
      email: 'test@test.com',
    };
    const formatted = formatUser(user);
    expect(formatted).not.toHaveProperty('passwordHash');
    expect(formatted).not.toHaveProperty('socialId');
    expect(formatted).toHaveProperty('email', 'test@test.com');
    expect(formatted).toHaveProperty('name', 'Test');
  });
});
