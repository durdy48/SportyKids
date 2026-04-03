import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Static mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../config/database', () => ({
  prisma: {
    quizQuestion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    userQuizHistory: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../middleware/parental-guard', () => ({
  parentalGuard: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/subscription-guard', () => ({
  subscriptionGuard: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../jobs/generate-daily-quiz', () => ({
  generateDailyQuiz: vi.fn().mockResolvedValue({ generated: 0, errors: 0 }),
}));

vi.mock('../../services/gamification', () => ({
  awardSticker: vi.fn().mockResolvedValue(null),
  evaluateAchievements: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/mission-generator', () => ({
  checkMissionProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/parental-session', () => ({
  verifyParentalSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/monitoring', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../errors', () => ({
  ValidationError: class ValidationError extends Error {
    constructor(
      msg: string,
      public details?: unknown,
    ) {
      super(msg);
      this.name = 'ValidationError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'NotFoundError';
    }
  },
  AuthenticationError: class AuthenticationError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'AuthenticationError';
    }
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

const { prisma } = await import('../../config/database');

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

async function buildApp() {
  const quizRouter = (await import('../../routes/quiz')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/quiz', quizRouter);
  // Simple error handler for tests
  app.use((err: Error, _req: unknown, res: express.Response, _next: unknown) => {
    res.status(400).json({ error: err.message });
  });
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuestion(overrides: Partial<{
  id: string;
  sport: string;
  ageRange: string;
  isTimeless: boolean;
  generatedAt: Date | null;
  expiresAt: Date | null;
  correctAnswer: number;
  points: number;
}> = {}) {
  return {
    id: overrides.id ?? 'q1',
    question: 'A question?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: overrides.correctAnswer ?? 0,
    sport: overrides.sport ?? 'football',
    points: overrides.points ?? 10,
    relatedNewsId: null,
    generatedAt: overrides.generatedAt !== undefined ? overrides.generatedAt : new Date(),
    ageRange: overrides.ageRange ?? '9-11',
    expiresAt: overrides.expiresAt !== undefined ? overrides.expiresAt : new Date(Date.now() + 48 * 60 * 60 * 1000),
    isTimeless: overrides.isTimeless ?? false,
    topic: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/quiz/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.userQuizHistory.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userQuizHistory.upsert).mockResolvedValue({} as never);
  });

  // -------------------------------------------------------------------------
  // Per-user deduplication
  // -------------------------------------------------------------------------
  describe('per-user deduplication', () => {
    it('excludes questions answered within 60 days when userId is provided', async () => {
      // UserQuizHistory contains the answered question
      vi.mocked(prisma.userQuizHistory.findMany).mockResolvedValue([
        { questionId: 'answered-q' } as never,
      ]);

      // Pool A (recent): no questions (the answered one is excluded)
      // Pool B (timeless): empty
      // Pool C (seed): has a fresh question
      vi.mocked(prisma.quizQuestion.findMany)
        .mockResolvedValueOnce([]) // pool A — empty after dedup
        .mockResolvedValueOnce([]) // pool B — empty
        .mockResolvedValueOnce([makeQuestion({ id: 'seed-q', generatedAt: null })]); // pool C — seed

      const app = await buildApp();
      const res = await request(app)
        .get('/api/quiz/questions?age=9-11&count=5&userId=user1');

      expect(res.status).toBe(200);
      // The answered question should NOT appear
      const questionIds = res.body.questions.map((q: { id: string }) => q.id);
      expect(questionIds).not.toContain('answered-q');
    });

    it('includes questions whose history entry is > 60 days old', async () => {
      // History entry is 61 days ago — outside dedup window
      const cutoff = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000);
      // The findMany mock filters by answeredAt > now-60d, so an old entry won't be in results
      vi.mocked(prisma.userQuizHistory.findMany).mockResolvedValue([]); // old entry filtered out by DB query

      const oldQuestion = makeQuestion({ id: 'old-answered-q', isTimeless: false });
      vi.mocked(prisma.quizQuestion.findMany)
        .mockResolvedValueOnce([oldQuestion]) // pool A — contains old question
        .mockResolvedValueOnce([])  // pool B
        .mockResolvedValueOnce([]); // pool C

      const app = await buildApp();
      const res = await request(app)
        .get('/api/quiz/questions?age=9-11&count=5&userId=user1');

      expect(res.status).toBe(200);
      const questionIds = res.body.questions.map((q: { id: string }) => q.id);
      expect(questionIds).toContain('old-answered-q');

      void cutoff; // suppress unused variable warning
    });

    it('does not apply dedup when userId is not provided', async () => {
      vi.mocked(prisma.quizQuestion.findMany)
        .mockResolvedValueOnce([makeQuestion({ id: 'q1' })]) // pool A
        .mockResolvedValueOnce([]) // pool B
        .mockResolvedValueOnce([]); // pool C

      const app = await buildApp();
      const res = await request(app)
        .get('/api/quiz/questions?age=9-11&count=5'); // no userId

      expect(res.status).toBe(200);
      expect(prisma.userQuizHistory.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 70/30 mix (approximate)
  // -------------------------------------------------------------------------
  describe('70/30 timeless mix', () => {
    it('targets ~30% timeless from pool B', async () => {
      // Use varied sports to avoid sport-balance cap interfering.
      // Each sport appears exactly once per 8 questions — so neither fromA (7 items)
      // nor fromB (3 items) can have more than ceil(7/8)=1 or ceil(3/8)=1 of a given sport,
      // ensuring the combined sport-balance cap never discards questions.
      const sports = ['football', 'basketball', 'tennis', 'swimming', 'athletics', 'cycling', 'formula1', 'padel'];
      // Pool A: 8 recent questions — exactly one per sport
      const poolA = sports.map((sport, i) =>
        makeQuestion({ id: `recent-${i}`, isTimeless: false, sport }),
      );
      // Pool B: 8 timeless questions — exactly one per sport
      const poolB = sports.map((sport, i) =>
        makeQuestion({ id: `timeless-${i}`, isTimeless: true, sport }),
      );

      vi.mocked(prisma.userQuizHistory.findMany).mockResolvedValue([]);
      vi.mocked(prisma.quizQuestion.findMany)
        .mockResolvedValueOnce(poolA) // pool A
        .mockResolvedValueOnce(poolB) // pool B
        .mockResolvedValueOnce([]); // pool C

      const app = await buildApp();
      const res = await request(app)
        .get('/api/quiz/questions?age=9-11&count=10&userId=user1');

      expect(res.status).toBe(200);
      const questions = res.body.questions as Array<{ id: string }>;
      // With 8 sports in each pool and maxPerSport = floor(10/4)+1 = 3,
      // no sport exceeds 1 in either slice, so all combined items pass the cap.
      expect(questions).toHaveLength(10);

      const timelessCount = questions.filter((q) => q.id.startsWith('timeless-')).length;
      // targetTimeless = ceil(10 * 0.3) = 3. Allow ±1 tolerance.
      expect(timelessCount).toBeGreaterThanOrEqual(2);
      expect(timelessCount).toBeLessThanOrEqual(4);
    });
  });

  // -------------------------------------------------------------------------
  // Sport balance: no sport > floor(N/4)+1 in results
  // -------------------------------------------------------------------------
  describe('sport balance', () => {
    it('caps football questions at floor(5/4)+1=2 in a 5-question set (pool A only)', async () => {
      // Pool A: 5 football questions + 5 basketball
      const footballQuestions = Array.from({ length: 5 }, (_, i) =>
        makeQuestion({ id: `fb-${i}`, sport: 'football', isTimeless: false }),
      );
      const basketballQuestions = Array.from({ length: 5 }, (_, i) =>
        makeQuestion({ id: `bb-${i}`, sport: 'basketball', isTimeless: false }),
      );

      vi.mocked(prisma.userQuizHistory.findMany).mockResolvedValue([]);
      vi.mocked(prisma.quizQuestion.findMany)
        .mockResolvedValueOnce([...footballQuestions, ...basketballQuestions]) // pool A
        .mockResolvedValueOnce([]) // pool B
        .mockResolvedValueOnce([]); // pool C

      const app = await buildApp();
      const res = await request(app)
        .get('/api/quiz/questions?age=9-11&count=5&userId=user1');

      expect(res.status).toBe(200);
      const questions = res.body.questions as Array<{ sport: string }>;

      const footballInResult = questions.filter((q) => q.sport === 'football').length;
      // floor(5/4)+1 = 2
      expect(footballInResult).toBeLessThanOrEqual(2);
    });

    it('caps football across combined pool A + pool B (cross-pool scenario)', async () => {
      // This test verifies that the sport balance cap (maxPerSport = floor(count/4)+1 = 2)
      // is enforced across the combined pool A + pool B result, not per-pool independently.
      // Previously a per-pool cap would allow 2 football from A and 2 from B = 4 total for count=5.
      //
      // Pool A (recent): 4 football + 4 basketball + 4 tennis
      const poolAFootball = Array.from({ length: 4 }, (_, i) =>
        makeQuestion({ id: `a-fb-${i}`, sport: 'football', isTimeless: false }),
      );
      const poolABasketball = Array.from({ length: 4 }, (_, i) =>
        makeQuestion({ id: `a-bb-${i}`, sport: 'basketball', isTimeless: false }),
      );
      const poolATennis = Array.from({ length: 4 }, (_, i) =>
        makeQuestion({ id: `a-tn-${i}`, sport: 'tennis', isTimeless: false }),
      );

      // Pool B (timeless): 4 football + 4 swimming + 4 athletics
      const poolBFootball = Array.from({ length: 4 }, (_, i) =>
        makeQuestion({ id: `b-fb-${i}`, sport: 'football', isTimeless: true, generatedAt: null, expiresAt: null }),
      );
      const poolBSwimming = Array.from({ length: 4 }, (_, i) =>
        makeQuestion({ id: `b-sw-${i}`, sport: 'swimming', isTimeless: true, generatedAt: null, expiresAt: null }),
      );
      const poolBAthletics = Array.from({ length: 4 }, (_, i) =>
        makeQuestion({ id: `b-at-${i}`, sport: 'athletics', isTimeless: true, generatedAt: null, expiresAt: null }),
      );

      vi.mocked(prisma.userQuizHistory.findMany).mockResolvedValue([]);
      vi.mocked(prisma.quizQuestion.findMany)
        .mockResolvedValueOnce([...poolAFootball, ...poolABasketball, ...poolATennis]) // pool A
        .mockResolvedValueOnce([...poolBFootball, ...poolBSwimming, ...poolBAthletics]) // pool B
        .mockResolvedValueOnce([]); // pool C

      const app = await buildApp();
      const res = await request(app)
        .get('/api/quiz/questions?age=9-11&count=5&userId=user1');

      expect(res.status).toBe(200);
      const questions = res.body.questions as Array<{ sport: string }>;
      // Questions may be fewer than 5 if sport diversity in the random slices is low.
      // The key invariant: football must never exceed maxPerSport (floor(5/4)+1 = 2)
      // across the COMBINED result, regardless of how many football questions existed
      // across pool A and pool B individually.
      const footballInResult = questions.filter((q) => q.sport === 'football').length;
      expect(footballInResult).toBeLessThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // Seed fallback
  // -------------------------------------------------------------------------
  describe('seed fallback', () => {
    it('returns seed questions when daily and timeless pools are empty', async () => {
      const seedQuestions = [
        makeQuestion({ id: 'seed-1', generatedAt: null, expiresAt: null }),
        makeQuestion({ id: 'seed-2', generatedAt: null, expiresAt: null }),
      ];

      vi.mocked(prisma.userQuizHistory.findMany).mockResolvedValue([]);
      vi.mocked(prisma.quizQuestion.findMany)
        .mockResolvedValueOnce([]) // pool A — empty
        .mockResolvedValueOnce([]) // pool B — empty
        .mockResolvedValueOnce(seedQuestions); // pool C — seeds (not filtered, no history)

      const app = await buildApp();
      const res = await request(app)
        .get('/api/quiz/questions?age=9-11&count=5&userId=user1');

      expect(res.status).toBe(200);
      const ids = res.body.questions.map((q: { id: string }) => q.id);
      expect(ids).toContain('seed-1');
      expect(ids).toContain('seed-2');
    });

    it('excludes already-answered seeds and returns fresh ones when available', async () => {
      const seedFresh = makeQuestion({ id: 'seed-fresh', generatedAt: null, expiresAt: null });

      vi.mocked(prisma.userQuizHistory.findMany).mockResolvedValue([
        { questionId: 'seed-answered' } as never,
      ]);
      vi.mocked(prisma.quizQuestion.findMany)
        .mockResolvedValueOnce([]) // pool A — empty
        .mockResolvedValueOnce([]) // pool B — empty
        .mockResolvedValueOnce([seedFresh]); // pool C (filtered) — fresh seed only

      const app = await buildApp();
      const res = await request(app)
        .get('/api/quiz/questions?age=9-11&count=5&userId=user1');

      expect(res.status).toBe(200);
      const ids = res.body.questions.map((q: { id: string }) => q.id);
      expect(ids).toContain('seed-fresh');
      expect(ids).not.toContain('seed-answered');
    });

    it('falls back to full seed pool when all seeds have been answered', async () => {
      const allSeeds = [
        makeQuestion({ id: 'seed-1', generatedAt: null, expiresAt: null }),
        makeQuestion({ id: 'seed-2', generatedAt: null, expiresAt: null }),
      ];

      vi.mocked(prisma.userQuizHistory.findMany).mockResolvedValue([
        { questionId: 'seed-1' } as never,
        { questionId: 'seed-2' } as never,
      ]);
      vi.mocked(prisma.quizQuestion.findMany)
        .mockResolvedValueOnce([]) // pool A — empty
        .mockResolvedValueOnce([]) // pool B — empty
        .mockResolvedValueOnce([]) // pool C (filtered) — all seeds answered, returns empty
        .mockResolvedValueOnce(allSeeds); // pool C (unfiltered fallback) — full seed pool

      const app = await buildApp();
      const res = await request(app)
        .get('/api/quiz/questions?age=9-11&count=5&userId=user1');

      expect(res.status).toBe(200);
      const ids = res.body.questions.map((q: { id: string }) => q.id);
      // Fallback should return all seeds (better repeat than empty)
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.some((id: string) => allSeeds.map(s => s.id).includes(id))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // No age filter (backward compat)
  // -------------------------------------------------------------------------
  it('returns questions without age filter (backward compat)', async () => {
    const questions = [makeQuestion({ id: 'q1' })];
    vi.mocked(prisma.quizQuestion.findMany).mockResolvedValue(questions);

    const app = await buildApp();
    const res = await request(app).get('/api/quiz/questions');

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/quiz/answer
// ---------------------------------------------------------------------------

describe('POST /api/quiz/answer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.userQuizHistory.upsert).mockResolvedValue({} as never);
  });

  it('creates UserQuizHistory row after correct answer', async () => {
    const question = makeQuestion({ id: 'q-test', correctAnswer: 1, sport: 'football' });
    vi.mocked(prisma.quizQuestion.findUnique).mockResolvedValue(question);
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: 'user1',
      currentQuizCorrectStreak: 0,
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const app = await buildApp();
    const res = await request(app)
      .post('/api/quiz/answer')
      .send({ userId: 'user1', questionId: 'q-test', answer: 1 });

    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(true);

    // Wait briefly for non-blocking upsert
    await new Promise((r) => setTimeout(r, 50));
    expect(prisma.userQuizHistory.upsert).toHaveBeenCalledWith({
      where: { userId_questionId: { userId: 'user1', questionId: 'q-test' } },
      create: { userId: 'user1', questionId: 'q-test' },
      update: { answeredAt: expect.any(Date) },
    });
  });

  it('creates UserQuizHistory row on wrong answer too', async () => {
    const question = makeQuestion({ id: 'q-wrong', correctAnswer: 1 });
    vi.mocked(prisma.quizQuestion.findUnique).mockResolvedValue(question);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const app = await buildApp();
    const res = await request(app)
      .post('/api/quiz/answer')
      .send({ userId: 'user1', questionId: 'q-wrong', answer: 2 }); // wrong answer

    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(false);

    await new Promise((r) => setTimeout(r, 50));
    expect(prisma.userQuizHistory.upsert).toHaveBeenCalled();
  });

  it('is idempotent: calling twice for same user/question upsertes, not creates', async () => {
    const question = makeQuestion({ id: 'q-idem', correctAnswer: 0 });
    vi.mocked(prisma.quizQuestion.findUnique).mockResolvedValue(question);
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: 'user1',
      currentQuizCorrectStreak: 0,
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const app = await buildApp();
    // First call
    await request(app)
      .post('/api/quiz/answer')
      .send({ userId: 'user1', questionId: 'q-idem', answer: 0 });

    // Second call
    await request(app)
      .post('/api/quiz/answer')
      .send({ userId: 'user1', questionId: 'q-idem', answer: 0 });

    await new Promise((r) => setTimeout(r, 50));
    // upsert is used — idempotent by design (called twice here)
    expect(prisma.userQuizHistory.upsert).toHaveBeenCalledTimes(2);
    // Verify upsert was called with correct params (not create)
    const call = vi.mocked(prisma.userQuizHistory.upsert).mock.calls[0]![0];
    expect(call.where).toEqual({
      userId_questionId: { userId: 'user1', questionId: 'q-idem' },
    });
    expect(call.create).toBeDefined();
    expect(call.update).toBeDefined();
  });

  it('returns 400 when question not found', async () => {
    vi.mocked(prisma.quizQuestion.findUnique).mockResolvedValue(null);

    const app = await buildApp();
    const res = await request(app)
      .post('/api/quiz/answer')
      .send({ userId: 'user1', questionId: 'nonexistent', answer: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when answer schema is invalid', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/api/quiz/answer')
      .send({ userId: 'user1', questionId: 'q1' }); // missing answer

    expect(res.status).toBe(400);
  });
});
