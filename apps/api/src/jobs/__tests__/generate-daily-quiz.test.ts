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

// AI client — provider available by default
vi.mock('../../services/ai-client', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
}));

// quiz-generator — mock both functions
vi.mock('../../services/quiz-generator', () => ({
  generateQuizFromNews: vi.fn().mockResolvedValue(null),
  generateTimelessQuestion: vi.fn().mockResolvedValue(null),
}));

// prisma mock
vi.mock('../../config/database', () => ({
  prisma: {
    newsItem: { findMany: vi.fn() },
    quizQuestion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    user: { findMany: vi.fn() },
  },
}));

// suppress dynamic imports (push-sender, shared t())
vi.mock('../../services/push-sender', () => ({
  sendPushToUsers: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

const { prisma } = await import('../../config/database');
const { isProviderAvailable } = await import('../../services/ai-client');
const { generateQuizFromNews, generateTimelessQuestion } = await import('../../services/quiz-generator');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArticle(id: string, sport = 'football') {
  return { id, title: `Title ${id}`, summary: `Detailed summary about this sports article with id ${id}, long enough to pass the 30-char filter`, sport, team: null };
}

function makeValidQuiz(topic?: string) {
  return {
    question: 'Who won?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    points: 10,
    topic: topic ?? 'some quiz topic',
  };
}

function makeTimelessQuestion(topic = 'timeless topic') {
  return {
    question: 'A timeless question?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 1,
    sport: 'football',
    ageRange: '9-11' as const,
    topic,
    isTimeless: true,
    points: 10,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateDailyQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Speed up tests by removing delays
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: Function) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    });
    // Default: provider available
    vi.mocked(isProviderAvailable).mockResolvedValue(true);
    // Default: no push users
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    // Default: no existing quiz combos
    vi.mocked(prisma.quizQuestion.findMany).mockResolvedValue([]);
    // Default: no topic duplicates
    vi.mocked(prisma.quizQuestion.findFirst).mockResolvedValue(null);
    // Default: create succeeds
    vi.mocked(prisma.quizQuestion.create).mockResolvedValue({} as never);
    // Default: count >= 3 (gap fill won't trigger)
    vi.mocked(prisma.quizQuestion.count).mockResolvedValue(5);
    // Default: generateTimelessQuestion returns null
    vi.mocked(generateTimelessQuestion).mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  // 48h news window
  // -------------------------------------------------------------------------
  describe('48h news window', () => {
    it('uses a 48h cutoff for newsItem query', async () => {
      const articles = [makeArticle('a1', 'football')];
      vi.mocked(prisma.newsItem.findMany).mockResolvedValue(articles);
      vi.mocked(generateQuizFromNews).mockResolvedValue(null);

      const before = Date.now();
      const { generateDailyQuiz } = await import('../generate-daily-quiz');
      await generateDailyQuiz();

      expect(prisma.newsItem.findMany).toHaveBeenCalled();
      const call = vi.mocked(prisma.newsItem.findMany).mock.calls[0]![0];
      const cutoffDate: Date = call.where?.publishedAt?.gte;
      expect(cutoffDate).toBeInstanceOf(Date);

      // The cutoff should be approximately 48h ago (within 5 seconds tolerance)
      const expectedCutoff = before - 48 * 60 * 60 * 1000;
      const diff = Math.abs(cutoffDate.getTime() - expectedCutoff);
      expect(diff).toBeLessThan(5000);
    });
  });

  // -------------------------------------------------------------------------
  // Topic dedup skip
  // -------------------------------------------------------------------------
  describe('topic dedup', () => {
    it('skips creating a question when topic is already in DB within 30 days', async () => {
      const articles = [makeArticle('a1', 'football')];
      vi.mocked(prisma.newsItem.findMany).mockResolvedValue(articles);
      vi.mocked(generateQuizFromNews).mockResolvedValue(makeValidQuiz('real madrid la liga'));
      // Simulate topic already in DB
      vi.mocked(prisma.quizQuestion.findFirst).mockResolvedValue({ id: 'existing-q' } as never);

      const { generateDailyQuiz } = await import('../generate-daily-quiz');
      await generateDailyQuiz();

      // create should NOT have been called due to topic collision
      expect(prisma.quizQuestion.create).not.toHaveBeenCalled();
    });

    it('creates a question when topic is NOT in DB', async () => {
      const articles = [makeArticle('a1', 'football')];
      vi.mocked(prisma.newsItem.findMany).mockResolvedValue(articles);
      vi.mocked(generateQuizFromNews).mockResolvedValue(makeValidQuiz('new unique topic'));
      // No existing topic
      vi.mocked(prisma.quizQuestion.findFirst).mockResolvedValue(null);

      const { generateDailyQuiz } = await import('../generate-daily-quiz');
      const result = await generateDailyQuiz();

      // create should have been called (3 age ranges)
      expect(prisma.quizQuestion.create).toHaveBeenCalled();
      expect(result.generated).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Per-sport gap fill
  // -------------------------------------------------------------------------
  describe('per-sport gap fill', () => {
    it('calls generateTimelessQuestion when sport/ageRange count < 3', async () => {
      vi.mocked(prisma.newsItem.findMany).mockResolvedValue([]);
      // Count below minimum for all sport/ageRange combinations
      vi.mocked(prisma.quizQuestion.count).mockResolvedValue(0);
      vi.mocked(generateTimelessQuestion).mockResolvedValue(makeTimelessQuestion());
      vi.mocked(prisma.quizQuestion.findFirst).mockResolvedValue(null); // no topic dups

      const { generateDailyQuiz } = await import('../generate-daily-quiz');
      await generateDailyQuiz();

      expect(generateTimelessQuestion).toHaveBeenCalled();
    });

    it('does NOT call generateTimelessQuestion when count >= 3', async () => {
      vi.mocked(prisma.newsItem.findMany).mockResolvedValue([]);
      // Count at or above minimum for all combinations
      vi.mocked(prisma.quizQuestion.count).mockResolvedValue(5);

      const { generateDailyQuiz } = await import('../generate-daily-quiz');
      await generateDailyQuiz();

      expect(generateTimelessQuestion).not.toHaveBeenCalled();
    });

    it('persists timeless question when gap fill triggers and no topic dup', async () => {
      vi.mocked(prisma.newsItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.quizQuestion.count).mockResolvedValue(1); // below minimum
      vi.mocked(generateTimelessQuestion).mockResolvedValue(makeTimelessQuestion('unique gap topic'));
      vi.mocked(prisma.quizQuestion.findFirst).mockResolvedValue(null); // no topic dup

      const { generateDailyQuiz } = await import('../generate-daily-quiz');
      const result = await generateDailyQuiz();

      expect(prisma.quizQuestion.create).toHaveBeenCalled();
      expect(result.generated).toBeGreaterThan(0);
    });

    it('skips gap fill question when topic is already a duplicate', async () => {
      vi.mocked(prisma.newsItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.quizQuestion.count).mockResolvedValue(0); // below minimum
      vi.mocked(generateTimelessQuestion).mockResolvedValue(makeTimelessQuestion('existing topic'));
      // Topic already exists
      vi.mocked(prisma.quizQuestion.findFirst).mockResolvedValue({ id: 'dup' } as never);

      const { generateDailyQuiz } = await import('../generate-daily-quiz');
      await generateDailyQuiz();

      expect(prisma.quizQuestion.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Provider unavailable
  // -------------------------------------------------------------------------
  it('returns early when AI provider is unavailable', async () => {
    vi.mocked(isProviderAvailable).mockResolvedValue(false);
    vi.mocked(prisma.newsItem.findMany).mockResolvedValue([]);

    const { generateDailyQuiz } = await import('../generate-daily-quiz');
    const result = await generateDailyQuiz();

    expect(result.generated).toBe(0);
    expect(prisma.newsItem.findMany).not.toHaveBeenCalled();
  });
});
