import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Static mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@sportykids/shared', () => ({
  SPORTS: ['football', 'basketball', 'tennis', 'swimming', 'athletics', 'cycling', 'formula1', 'padel'],
}));

vi.mock('../../services/ai-client', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../services/quiz-generator', () => ({
  generateTimelessQuestion: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    quizQuestion: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

const { prisma } = await import('../../config/database');
const { isProviderAvailable } = await import('../../services/ai-client');
const { generateTimelessQuestion } = await import('../../services/quiz-generator');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTimelessQuestion(topic = 'football world cup') {
  return {
    question: 'When was the first World Cup?',
    options: ['1930', '1950', '1920', '1940'],
    correctAnswer: 0,
    sport: 'football',
    ageRange: '9-11' as const,
    topic,
    isTimeless: true,
    points: 10,
  };
}

const SPORTS_COUNT = 8;
const AGE_RANGES_COUNT = 3;
const QUESTIONS_PER_SLOT = 2;
const TOTAL_EXPECTED = SPORTS_COUNT * AGE_RANGES_COUNT * QUESTIONS_PER_SLOT; // 48

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateTimelessQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isProviderAvailable).mockResolvedValue(true);
    vi.mocked(prisma.quizQuestion.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.quizQuestion.create).mockResolvedValue({} as never);
    vi.mocked(generateTimelessQuestion).mockResolvedValue(makeTimelessQuestion());
    // Speed up tests by removing 500ms delays
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: Function) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    });
  });

  // -------------------------------------------------------------------------
  // Happy path: 48 questions created
  // -------------------------------------------------------------------------
  it('creates up to 48 questions (8 sports × 3 age ranges × 2 per slot)', async () => {
    let callCount = 0;
    vi.mocked(generateTimelessQuestion).mockImplementation(async (sport, ageRange) => {
      callCount++;
      return makeTimelessQuestion(`${sport} ${ageRange} q${callCount}`);
    });

    const { generateTimelessQuiz } = await import('../generate-timeless-quiz');
    const result = await generateTimelessQuiz();

    expect(result.generated).toBe(TOTAL_EXPECTED);
    expect(prisma.quizQuestion.create).toHaveBeenCalledTimes(TOTAL_EXPECTED);
  });

  // -------------------------------------------------------------------------
  // Topic collision retry: first call returns collision, second returns new topic
  // -------------------------------------------------------------------------
  it('retries on topic collision and persists the non-colliding question', async () => {
    let attempt = 0;
    vi.mocked(generateTimelessQuestion).mockImplementation(async () => {
      attempt++;
      return makeTimelessQuestion(attempt === 1 ? 'colliding topic' : 'fresh topic');
    });

    // First call: topic collision; subsequent: no collision
    let findFirstCallCount = 0;
    vi.mocked(prisma.quizQuestion.findFirst).mockImplementation(async () => {
      findFirstCallCount++;
      // Simulate: 'colliding topic' exists, 'fresh topic' does not
      // We simplify: the first findFirst call returns a collision
      if (findFirstCallCount === 1) return { id: 'existing' } as never;
      return null;
    });

    const { generateTimelessQuiz } = await import('../generate-timeless-quiz');
    const result = await generateTimelessQuiz();

    // Should have persisted questions (not zero, since retries succeed)
    expect(result.generated).toBeGreaterThan(0);
    expect(prisma.quizQuestion.create).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Max retries exceeded: all attempts return colliding topics
  // -------------------------------------------------------------------------
  it('skips slot and continues when all 3 retry attempts collide', async () => {
    // All generated questions have the same colliding topic
    vi.mocked(generateTimelessQuestion).mockResolvedValue(makeTimelessQuestion('always collides'));
    // Topic always exists in DB
    vi.mocked(prisma.quizQuestion.findFirst).mockResolvedValue({ id: 'existing' } as never);

    const { generateTimelessQuiz } = await import('../generate-timeless-quiz');
    const result = await generateTimelessQuiz();

    // No questions should be created due to all collisions
    expect(prisma.quizQuestion.create).not.toHaveBeenCalled();
    // Job should complete without throwing
    expect(result.generated).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AI unavailable: generateTimelessQuestion returns null
  // -------------------------------------------------------------------------
  it('skips slot when generateTimelessQuestion returns null, job continues', async () => {
    vi.mocked(generateTimelessQuestion).mockResolvedValue(null);

    const { generateTimelessQuiz } = await import('../generate-timeless-quiz');
    const result = await generateTimelessQuiz();

    expect(prisma.quizQuestion.create).not.toHaveBeenCalled();
    expect(result.generated).toBe(0);
    // skipped should reflect the null returns (one per slot attempt)
    expect(result.skipped).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Provider unavailable
  // -------------------------------------------------------------------------
  it('returns early when AI provider is unavailable', async () => {
    vi.mocked(isProviderAvailable).mockResolvedValue(false);

    const { generateTimelessQuiz } = await import('../generate-timeless-quiz');
    const result = await generateTimelessQuiz();

    expect(result.generated).toBe(0);
    expect(generateTimelessQuestion).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Error handling: create throws — errors counted, job continues
  // -------------------------------------------------------------------------
  it('counts errors and continues when prisma.create throws', async () => {
    vi.mocked(generateTimelessQuestion).mockResolvedValue(makeTimelessQuestion('unique topic'));
    vi.mocked(prisma.quizQuestion.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.quizQuestion.create).mockRejectedValue(new Error('DB error'));

    const { generateTimelessQuiz } = await import('../generate-timeless-quiz');
    const result = await generateTimelessQuiz();

    expect(result.errors).toBeGreaterThan(0);
    expect(result.generated).toBe(0);
  });
});
