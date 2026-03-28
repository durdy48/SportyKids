'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { QuizQuestion } from '@sportykids/shared';
import { sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { submitAnswer } from '@/lib/api';
import { celebratePerfectQuiz } from '@/lib/celebrations';

interface QuizGameProps {
  questions: QuizQuestion[];
  userId: string;
  onFinish: (pointsEarned: number) => void;
  locale: Locale;
}

export function QuizGame({ questions, userId, onFinish, locale }: QuizGameProps) {
  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; correctAnswer: number } | null>(null);
  const [accumulatedPoints, setAccumulatedPoints] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const currentQuestion = questions[index];
  const isLast = index === questions.length - 1;

  const answer = async (option: number) => {
    if (result || submitting) return;
    setSelection(option);
    setSubmitting(true);

    try {
      const res = await submitAnswer(userId, currentQuestion.id, option);
      setResult(res);
      setAccumulatedPoints((p) => p + res.pointsEarned);
      if (res.correct) {
        const newCorrectCount = correctCount + 1;
        setCorrectCount(newCorrectCount);
        // Perfect score: all questions answered correctly on the last one
        if (isLast && newCorrectCount === questions.length) {
          celebratePerfectQuiz();
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (isLast) {
      onFinish(accumulatedPoints);
      return;
    }
    setIndex(index + 1);
    setSelection(null);
    setResult(null);
  };

  const optionColor = (i: number) => {
    if (!result) {
      return selection === i ? 'border-[var(--color-blue)] bg-[var(--color-blue)]/10' : 'border-[var(--color-border)] hover:bg-[var(--color-background)]';
    }
    if (i === result.correctAnswer) return 'border-[var(--color-green)] bg-[var(--color-green)]/10';
    if (i === selection && !result.correct) return 'border-red-400 bg-red-50 dark:bg-red-900/20';
    return 'border-[var(--color-border)] opacity-50';
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex gap-1.5 flex-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i < index ? 'bg-[var(--color-green)]' : i === index ? 'bg-[var(--color-blue)]' : 'bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-[var(--color-muted)] font-medium">
          {index + 1}/{questions.length}
        </span>
      </div>

      {/* Question */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs bg-[var(--color-background)] px-2.5 py-1 rounded-full font-medium text-[var(--color-muted)]">
            {sportToEmoji(currentQuestion.sport)} {getSportLabel(currentQuestion.sport, locale)} · {currentQuestion.points} {t('quiz.pts', locale)}
          </span>
          {currentQuestion.isDaily && (
            <span className="text-xs bg-[#2563EB] text-white px-2.5 py-1 rounded-full font-medium">
              📰 {t('quiz.daily_quiz', locale)}
            </span>
          )}
        </div>
        <h3 className="font-[family-name:var(--font-poppins)] text-xl font-bold text-[var(--color-text)] mt-4 mb-6">
          {currentQuestion.question}
        </h3>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, i) => (
            <button
              key={i}
              onClick={() => answer(i)}
              disabled={!!result}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${optionColor(i)}`}
            >
              <span className="inline-block w-6 h-6 rounded-full bg-[var(--color-background)] text-center text-xs leading-6 mr-3 font-bold">
                {String.fromCharCode(65 + i)}
              </span>
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback and next */}
      {result && (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl text-sm font-medium ${
            result.correct
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
          }`}>
            {result.correct ? t('quiz.correct', locale) : t('quiz.incorrect', locale)}
          </div>

          {currentQuestion.relatedNewsId && (
            <Link
              href={`/news/${currentQuestion.relatedNewsId}`}
              className="block text-center text-sm font-medium text-[#2563EB] hover:underline"
            >
              📰 {t('quiz.read_news', locale)}
            </Link>
          )}

          <button
            onClick={next}
            className="w-full py-3 rounded-xl text-sm font-medium bg-[var(--color-blue)] text-white hover:bg-blue-700 transition-colors"
          >
            {isLast ? t('quiz.view_results', locale) : t('buttons.next_question', locale)}
          </button>
        </div>
      )}

      {/* Accumulated points */}
      <div className="text-center mt-4 text-sm text-[var(--color-muted)]">
        {t('quiz.round_points', locale)} <span className="font-bold text-[var(--color-yellow)]">{accumulatedPoints}</span>
      </div>
    </div>
  );
}
