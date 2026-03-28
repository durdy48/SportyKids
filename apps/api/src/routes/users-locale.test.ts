import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../config/database', () => ({
  prisma: {
    user: {
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// Import after mocks
import express from 'express';
import request from 'supertest';
import usersRouter from './users';

const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);

function fakeDbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Lucia',
    age: 10,
    email: null,
    passwordHash: null,
    authProvider: 'anonymous',
    role: 'child',
    parentUserId: null,
    lastLoginAt: null,
    favoriteSports: '["football"]',
    favoriteTeam: 'Real Madrid',
    selectedFeeds: '[]',
    pushEnabled: false,
    pushPreferences: null,
    totalPoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    currentQuizCorrectStreak: 0,
    quizPerfectCount: 0,
    locale: 'es',
    country: 'ES',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/users — locale and country', () => {
  it('accepts locale and country in create payload', async () => {
    mockCreate.mockResolvedValue(fakeDbUser({ locale: 'en', country: 'GB' }));

    const res = await request(app)
      .post('/api/users')
      .send({
        name: 'Lucia',
        age: 10,
        favoriteSports: ['football'],
        locale: 'en',
        country: 'GB',
      });

    expect(res.status).toBe(201);
    expect(res.body.locale).toBe('en');
    expect(res.body.country).toBe('GB');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locale: 'en',
          country: 'GB',
        }),
      }),
    );
  });

  it('defaults to locale=es and country=ES when not provided', async () => {
    mockCreate.mockResolvedValue(fakeDbUser());

    const res = await request(app)
      .post('/api/users')
      .send({
        name: 'Lucia',
        age: 10,
        favoriteSports: ['football'],
      });

    expect(res.status).toBe(201);
    // The defaults come from Prisma schema, so the create call should NOT include locale/country
    // unless they were explicitly sent
    const createArgs = mockCreate.mock.calls[0][0];
    expect(createArgs.data.locale).toBeUndefined();
    expect(createArgs.data.country).toBeUndefined();
    // Verify response includes default values from DB
    expect(res.body.locale).toBe('es');
    expect(res.body.country).toBe('ES');
  });

  it('rejects invalid locale values', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({
        name: 'Lucia',
        age: 10,
        favoriteSports: ['football'],
        locale: 'fr',
      });

    expect(res.status).toBe(400);
  });

  it('rejects invalid country values', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({
        name: 'Lucia',
        age: 10,
        favoriteSports: ['football'],
        country: 'XX',
      });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/users/:id — locale and country', () => {
  it('updates locale and country', async () => {
    mockFindUnique.mockResolvedValue(fakeDbUser());
    mockUpdate.mockResolvedValue(fakeDbUser({ locale: 'en', country: 'GB' }));

    const res = await request(app)
      .put('/api/users/user-1')
      .send({ locale: 'en', country: 'GB' });

    expect(res.status).toBe(200);
    expect(res.body.locale).toBe('en');
    expect(res.body.country).toBe('GB');
  });

  it('can update locale alone without other fields', async () => {
    mockFindUnique.mockResolvedValue(fakeDbUser());
    mockUpdate.mockResolvedValue(fakeDbUser({ locale: 'en' }));

    const res = await request(app)
      .put('/api/users/user-1')
      .send({ locale: 'en' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locale: 'en',
        }),
      }),
    );
  });

  it('rejects invalid locale on update', async () => {
    mockFindUnique.mockResolvedValue(fakeDbUser());

    const res = await request(app)
      .put('/api/users/user-1')
      .send({ locale: 'de' });

    expect(res.status).toBe(400);
  });

  it('rejects invalid country on update', async () => {
    mockFindUnique.mockResolvedValue(fakeDbUser());

    const res = await request(app)
      .put('/api/users/user-1')
      .send({ country: 'ZZ' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/users/:id — returns locale and country', () => {
  it('includes locale and country in response', async () => {
    mockFindUnique.mockResolvedValue(fakeDbUser({ locale: 'en', country: 'US' }));

    const res = await request(app)
      .get('/api/users/user-1');

    expect(res.status).toBe(200);
    expect(res.body.locale).toBe('en');
    expect(res.body.country).toBe('US');
  });
});
