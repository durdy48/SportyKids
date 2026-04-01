import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizGame } from './QuizGame';
import type { QuizQuestion } from '@sportykids/shared';

vi.mock('@sportykids/shared', () => ({
  sportToEmoji: (sport: string) => sport,
  getSportLabel: (sport: string) => sport,
  t: (key: string) => key,
}));

const mockSubmitAnswer = vi.fn();
vi.mock('@/lib/api', () => ({
  submitAnswer: (...args: unknown[]) => mockSubmitAnswer(...args),
}));

const questions: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Who won the 2024 Ballon d\'Or?',
    options: ['Messi', 'Vinicius', 'Haaland', 'Mbappe'],
    correctAnswer: 1,
    sport: 'football',
    points: 10,
  },
  {
    id: 'q2',
    question: 'How many players on a basketball team?',
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
    sport: 'basketball',
    points: 10,
  },
];

describe('QuizGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the first question text', () => {
    render(<QuizGame questions={questions} userId="u1" onFinish={vi.fn()} locale="es" />);
    expect(screen.getByText('Who won the 2024 Ballon d\'Or?')).toBeInTheDocument();
  });

  it('renders all answer options', () => {
    render(<QuizGame questions={questions} userId="u1" onFinish={vi.fn()} locale="es" />);
    expect(screen.getByText('Messi')).toBeInTheDocument();
    expect(screen.getByText('Vinicius')).toBeInTheDocument();
    expect(screen.getByText('Haaland')).toBeInTheDocument();
    expect(screen.getByText('Mbappe')).toBeInTheDocument();
  });

  it('shows progress indicator', () => {
    render(<QuizGame questions={questions} userId="u1" onFinish={vi.fn()} locale="es" />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('submits answer and shows feedback on option click', async () => {
    mockSubmitAnswer.mockResolvedValueOnce({ correct: true, correctAnswer: 1, pointsEarned: 10 });
    render(<QuizGame questions={questions} userId="u1" onFinish={vi.fn()} locale="es" />);

    fireEvent.click(screen.getByText('Vinicius'));

    await waitFor(() => {
      expect(mockSubmitAnswer).toHaveBeenCalledWith('u1', 'q1', 1);
    });

    await waitFor(() => {
      expect(screen.getByText('quiz.correct')).toBeInTheDocument();
    });
  });

  it('shows next button after answering (not the last question)', async () => {
    mockSubmitAnswer.mockResolvedValueOnce({ correct: true, correctAnswer: 1, pointsEarned: 10 });
    render(<QuizGame questions={questions} userId="u1" onFinish={vi.fn()} locale="es" />);

    fireEvent.click(screen.getByText('Vinicius'));

    await waitFor(() => {
      expect(screen.getByText('buttons.next_question')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('answer buttons have aria-labels with option text', () => {
      render(<QuizGame questions={questions} userId="u1" onFinish={vi.fn()} locale="es" />);
      expect(screen.getByLabelText('Option A: Messi')).toBeInTheDocument();
      expect(screen.getByLabelText('Option B: Vinicius')).toBeInTheDocument();
      expect(screen.getByLabelText('Option C: Haaland')).toBeInTheDocument();
      expect(screen.getByLabelText('Option D: Mbappe')).toBeInTheDocument();
    });

    it('shows feedback with role="status" after answering', async () => {
      mockSubmitAnswer.mockResolvedValueOnce({ correct: true, correctAnswer: 1, pointsEarned: 10 });
      render(<QuizGame questions={questions} userId="u1" onFinish={vi.fn()} locale="es" />);
      fireEvent.click(screen.getByText('Vinicius'));

      await waitFor(() => {
        const feedback = screen.getByRole('status');
        expect(feedback).toBeInTheDocument();
        expect(feedback).toHaveTextContent('quiz.correct');
      });
    });
  });
});
