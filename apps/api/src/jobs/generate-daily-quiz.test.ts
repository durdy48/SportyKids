import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(() => ({ stop: vi.fn() })) },
}));

// Mock logger
vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock ai-client
const mockIsProviderAvailable = vi.fn();
vi.mock('../services/ai-client', () => ({
  isProviderAvailable: (...args: unknown[]) => mockIsProviderAvailable(...args),
}));

// Mock quiz-generator
const mockGenerateQuizFromNews = vi.fn();
vi.mock('../services/quiz-generator', () => ({
  generateQuizFromNews: (...args: unknown[]) => mockGenerateQuizFromNews(...args),
}));

// Mock push-sender
const mockSendPushToUsers = vi.fn();
vi.mock('../services/push-sender', () => ({
  sendPushToUsers: (...args: unknown[]) => mockSendPushToUsers(...args),
}));

// Mock @sportykids/shared
const mockT = vi.fn((key: string, locale: string) => `${key}[${locale}]`);
vi.mock('@sportykids/shared', () => ({
  t: (...args: unknown[]) => mockT(...(args as [string, string])),
}));

// Mock prisma
const mockFindManyNews = vi.fn();
const mockFindManyQuiz = vi.fn();
const mockCreateQuiz = vi.fn();
const mockFindManyUser = vi.fn();
vi.mock('../config/database', () => ({
  prisma: {
    newsItem: { findMany: (...args: unknown[]) => mockFindManyNews(...args) },
    quizQuestion: {
      findMany: (...args: unknown[]) => mockFindManyQuiz(...args),
      create: (...args: unknown[]) => mockCreateQuiz(...args),
    },
    user: { findMany: (...args: unknown[]) => mockFindManyUser(...args) },
  },
}));

import { generateDailyQuiz } from './generate-daily-quiz';

describe('generate-daily-quiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Speed up tests by removing the 1-second delay
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: Function) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    });
  });

  it('should skip when AI provider is not available', async () => {
    mockIsProviderAvailable.mockResolvedValue(false);

    const result = await generateDailyQuiz();

    expect(result).toEqual({ generated: 0, errors: 0 });
    expect(mockFindManyNews).not.toHaveBeenCalled();
  });

  it('should generate quizzes for each age range from recent news', async () => {
    mockIsProviderAvailable.mockResolvedValue(true);
    mockFindManyNews.mockResolvedValue([
      { id: 'n1', title: 'Goal!', summary: 'A goal was scored', sport: 'football', team: 'Real Madrid' },
    ]);
    mockFindManyQuiz.mockResolvedValue([]); // No existing quizzes
    mockGenerateQuizFromNews.mockResolvedValue({
      question: 'Who scored?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0,
      points: 10,
    });
    mockCreateQuiz.mockResolvedValue({});
    mockFindManyUser.mockResolvedValue([]);

    const result = await generateDailyQuiz();

    // Should generate for 3 age ranges (6-8, 9-11, 12-14)
    expect(result.generated).toBe(3);
    expect(result.errors).toBe(0);
    expect(mockCreateQuiz).toHaveBeenCalledTimes(3);
  });

  it('should skip existing age range combos', async () => {
    mockIsProviderAvailable.mockResolvedValue(true);
    mockFindManyNews.mockResolvedValue([
      { id: 'n1', title: 'Goal!', summary: 'Summary', sport: 'football', team: null },
    ]);
    // Already has quiz for 6-8 and 9-11
    mockFindManyQuiz.mockResolvedValue([
      { relatedNewsId: 'n1', ageRange: '6-8' },
      { relatedNewsId: 'n1', ageRange: '9-11' },
    ]);
    mockGenerateQuizFromNews.mockResolvedValue({
      question: 'Q?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 1,
      points: 10,
    });
    mockCreateQuiz.mockResolvedValue({});
    mockFindManyUser.mockResolvedValue([]);

    const result = await generateDailyQuiz();

    // Only 12-14 should be generated
    expect(result.generated).toBe(1);
    expect(mockCreateQuiz).toHaveBeenCalledTimes(1);
  });

  it('should count errors when quiz generation fails', async () => {
    mockIsProviderAvailable.mockResolvedValue(true);
    mockFindManyNews.mockResolvedValue([
      { id: 'n1', title: 'News', summary: 'S', sport: 'tennis', team: null },
    ]);
    mockFindManyQuiz.mockResolvedValue([]);
    mockGenerateQuizFromNews.mockRejectedValue(new Error('AI error'));

    const result = await generateDailyQuiz();

    expect(result.errors).toBe(3); // 3 age ranges all failed
    expect(result.generated).toBe(0);
  });

  it('should send push notification when quizzes are generated', async () => {
    mockIsProviderAvailable.mockResolvedValue(true);
    mockFindManyNews.mockResolvedValue([
      { id: 'n1', title: 'News', summary: 'S', sport: 'football', team: null },
    ]);
    mockFindManyQuiz.mockResolvedValue([]);
    mockGenerateQuizFromNews.mockResolvedValue({
      question: 'Q?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0,
      points: 10,
    });
    mockCreateQuiz.mockResolvedValue({});
    mockFindManyUser.mockResolvedValue([{ id: 'u1', locale: 'es' }]);
    mockSendPushToUsers.mockResolvedValue(undefined);

    await generateDailyQuiz();

    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      ['u1'],
      expect.objectContaining({ data: { screen: 'Quiz' } }),
      'dailyQuiz',
    );
  });

  it('should send locale-aware push notifications grouped by user locale', async () => {
    mockIsProviderAvailable.mockResolvedValue(true);
    mockFindManyNews.mockResolvedValue([
      { id: 'n1', title: 'News', summary: 'S', sport: 'football', team: null },
    ]);
    mockFindManyQuiz.mockResolvedValue([]);
    mockGenerateQuizFromNews.mockResolvedValue({
      question: 'Q?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0,
      points: 10,
    });
    mockCreateQuiz.mockResolvedValue({});
    mockFindManyUser.mockResolvedValue([
      { id: 'u1', locale: 'es' },
      { id: 'u2', locale: 'en' },
      { id: 'u3', locale: null },
    ]);
    mockSendPushToUsers.mockResolvedValue(undefined);

    await generateDailyQuiz();

    // Spanish batch (u1 + u3 who defaults to es)
    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      ['u1', 'u3'],
      expect.objectContaining({
        title: 'push.quiz_ready_title[es]',
        body: 'push.quiz_ready_body[es]',
      }),
      'dailyQuiz',
    );
    // English batch (u2)
    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      ['u2'],
      expect.objectContaining({
        title: 'push.quiz_ready_title[en]',
        body: 'push.quiz_ready_body[en]',
      }),
      'dailyQuiz',
    );
  });

  it('should default to es locale when user has no locale set', async () => {
    mockIsProviderAvailable.mockResolvedValue(true);
    mockFindManyNews.mockResolvedValue([
      { id: 'n1', title: 'News', summary: 'S', sport: 'tennis', team: null },
    ]);
    mockFindManyQuiz.mockResolvedValue([]);
    mockGenerateQuizFromNews.mockResolvedValue({
      question: 'Q?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0,
      points: 10,
    });
    mockCreateQuiz.mockResolvedValue({});
    mockFindManyUser.mockResolvedValue([{ id: 'u1', locale: null }]);
    mockSendPushToUsers.mockResolvedValue(undefined);

    await generateDailyQuiz();

    expect(mockT).toHaveBeenCalledWith('push.quiz_ready_title', 'es');
    expect(mockT).toHaveBeenCalledWith('push.quiz_ready_body', 'es');
  });
});
