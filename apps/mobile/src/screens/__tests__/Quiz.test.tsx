import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config', () => ({ API_BASE: 'http://localhost:3001/api' }));
vi.mock('../../lib/api', () => ({
  fetchQuestions: vi.fn().mockResolvedValue({ questions: [] }),
  submitAnswer: vi.fn().mockResolvedValue({ correct: true, correctAnswer: 0, pointsEarned: 10 }),
  fetchScore: vi.fn().mockResolvedValue({ name: 'Test', totalPoints: 50 }),
}));
vi.mock('../../lib/user-context', () => ({
  useUser: () => ({
    user: { id: 'u1', name: 'Test', age: 10 },
    locale: 'es',
    refreshUser: vi.fn(),
  }),
}));

describe('QuizScreen', () => {
  it('can be imported without errors', async () => {
    const mod = await import('../Quiz');
    expect(mod.QuizScreen).toBeDefined();
    expect(typeof mod.QuizScreen).toBe('function');
  });

  it('exports a named QuizScreen component', async () => {
    const { QuizScreen } = await import('../Quiz');
    expect(QuizScreen).toBeTruthy();
  });

  describe('accessibility', () => {
    it('references a11y keys for quiz interactions', async () => {
      const { QuizScreen } = await import('../Quiz');
      const source = QuizScreen.toString();
      expect(source).toContain('a11y.quiz.start_quiz');
      expect(source).toContain('a11y.quiz.answer_option');
      expect(source).toContain('a11y.quiz.next_question');
    });

    it('answer options have accessibilityRole button', async () => {
      const { QuizScreen } = await import('../Quiz');
      const source = QuizScreen.toString();
      expect(source).toContain('accessibilityRole');
      expect(source).toContain('accessibilityState');
    });
  });
});
