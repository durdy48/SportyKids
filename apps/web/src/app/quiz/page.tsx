'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { QuizQuestion } from '@sportykids/shared';
import { t } from '@sportykids/shared';
import { fetchQuestions, fetchScore } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { QuizGame } from '@/components/QuizGame';

type State = 'start' | 'playing' | 'result';

export default function QuizPage() {
  const { user, loading: userLoading, locale } = useUser();
  const router = useRouter();

  const [state, setState] = useState<State>('start');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [roundPoints, setRoundPoints] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) router.replace('/onboarding');
  }, [userLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchScore(user.id)
        .then((r) => setTotalPoints(r.totalPoints))
        .catch(console.error);
    }
  }, [user]);

  const startQuiz = async () => {
    setLoading(true);
    try {
      const result = await fetchQuestions(5);
      setQuestions(result.questions);
      setState('playing');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const finishQuiz = (points: number) => {
    setRoundPoints(points);
    setTotalPoints((prev) => prev + points);
    setState('result');
  };

  if (userLoading || !user) return null;

  return (
    <div className="space-y-6">
      {state === 'start' && (
        <div className="max-w-md mx-auto text-center py-8">
          <span className="text-6xl block mb-4">🧠</span>
          <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-bold text-[var(--color-text)] mb-2">
            {t('quiz.title', locale)}
          </h2>
          <p className="text-gray-500 mb-6">
            {t('quiz.subtitle', locale)}
          </p>

          <div className="bg-[var(--color-yellow)]/10 rounded-2xl p-6 mb-6">
            <p className="text-sm text-gray-500">{t('quiz.total_score', locale)}</p>
            <p className="text-4xl font-bold text-[var(--color-yellow)] font-[family-name:var(--font-poppins)]">
              {totalPoints} {t('quiz.pts', locale)}
            </p>
          </div>

          <button
            onClick={startQuiz}
            disabled={loading}
            className="px-8 py-4 bg-[var(--color-green)] text-white rounded-2xl font-semibold text-lg hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {loading ? t('buttons.loading', locale) : t('buttons.start_quiz', locale)}
          </button>
        </div>
      )}

      {state === 'playing' && questions.length > 0 && (
        <QuizGame
          questions={questions}
          userId={user.id}
          onFinish={finishQuiz}
          locale={locale}
        />
      )}

      {state === 'result' && (
        <div className="max-w-md mx-auto text-center py-8">
          <span className="text-6xl block mb-4">🏆</span>
          <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-bold text-[var(--color-text)] mb-2">
            {t('quiz.completed', locale)}
          </h2>

          <div className="bg-[var(--color-green)]/10 rounded-2xl p-6 mb-4">
            <p className="text-sm text-gray-500">{t('quiz.points_earned', locale)}</p>
            <p className="text-5xl font-bold text-[var(--color-green)] font-[family-name:var(--font-poppins)]">
              +{roundPoints}
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <p className="text-sm text-gray-500">{t('quiz.total_score', locale)}</p>
            <p className="text-2xl font-bold text-[var(--color-text)]">{totalPoints} {t('quiz.pts', locale)}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setState('start'); setRoundPoints(0); }}
              className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              {t('buttons.back', locale)}
            </button>
            <button
              onClick={() => { setState('start'); setRoundPoints(0); startQuiz(); }}
              className="flex-1 py-3 bg-[var(--color-blue)] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              {t('buttons.play_again', locale)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
