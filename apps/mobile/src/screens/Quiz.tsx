import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import type { QuizQuestion } from '@sportykids/shared';
import { sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import { fetchQuestions, submitAnswer, fetchScore, recordActivity } from '../lib/api';
import { useUser } from '../lib/user-context';
import { haptic } from '../lib/haptics';
import { BrandedRefreshControl } from '../components/BrandedRefreshControl';

type GameState = 'start' | 'playing' | 'result';

export function QuizScreen() {
  const { user, locale, refreshUser, colors } = useUser();
  const [blocked, setBlocked] = useState(false);
  const s = createStyles(colors);
  const [gameState, setGameState] = useState<GameState>('start');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctAnswer: number; pointsEarned: number } | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [roundPoints, setRoundPoints] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchScore(user.id)
        .then((d) => setTotalPoints(d.totalPoints))
        // eslint-disable-next-line no-console
        .catch((err) => __DEV__ && console.error(err));
      // Pre-check if quiz is blocked by parental controls
      fetchQuestions(1, undefined, undefined, user.id)
        .catch((err) => {
          const e = err as Error & { formatBlocked?: boolean };
          if (e.formatBlocked) setBlocked(true);
        });
    }
  }, [user]);

  const startQuiz = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Map numeric age to age range for API
      let ageRange: string | undefined;
      if (user.age) {
        if (user.age <= 8) ageRange = '6-8';
        else if (user.age <= 11) ageRange = '9-11';
        else ageRange = '12-14';
      }
      const data = await fetchQuestions(5, undefined, ageRange, user.id);
      setQuestions(data.questions);
      setIndex(0);
      setRoundPoints(0);
      setSelection(null);
      setFeedback(null);
      setGameState('playing');
    } catch (err) {
      const e = err as Error & { formatBlocked?: boolean };
      if (e.formatBlocked) {
        setBlocked(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const answer = async (option: number) => {
    if (feedback || !user) return;
    setSelection(option);
    try {
      const data = await submitAnswer(user.id, questions[index].id, option);
      setFeedback(data);
      setRoundPoints((p) => p + data.pointsEarned);
      haptic(data.correct ? 'success' : 'error');
      recordActivity(user.id, 'quizzes_played').catch(() => {});
    } catch (err) {
      __DEV__ && console.error(err); // eslint-disable-line no-console
    }
  };

  const next = () => {
    if (index === questions.length - 1) {
      setTotalPoints((p) => p + roundPoints);
      setGameState('result');
      refreshUser(); // Sync points/stickers from server
      return;
    }
    setIndex(index + 1);
    setSelection(null);
    setFeedback(null);
  };

  if (!user) return null;

  const question = questions[index];

  if (blocked) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>{'\u{1F6AB}'}</Text>
        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 20, color: colors.text, textAlign: 'center', marginBottom: 8 }}>
          {t('parental.blocked_content', locale)}
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center' }}>
          {t('parental.blocked_by_parent', locale)}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={
        gameState === 'start' ? (
          <BrandedRefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!user) return;
              setRefreshing(true);
              fetchScore(user.id)
                .then((d) => setTotalPoints(d.totalPoints))
                .catch(() => {})
                .finally(() => setRefreshing(false));
            }}
            locale={locale}
          />
        ) : undefined
      }
    >
      {gameState === 'start' && (
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🧠</Text>
          <Text style={s.titleLarge}>{t('quiz.title', locale)}</Text>
          <Text style={s.subtitle}>{t('quiz.subtitle', locale)}</Text>
          <View style={s.pointsBox}>
            <Text style={s.pointsLabel}>{t('quiz.total_score', locale)}</Text>
            <Text style={s.pointsValue}>{totalPoints} {t('quiz.pts', locale)}</Text>
          </View>
          <TouchableOpacity
            style={s.buttonGreen}
            onPress={startQuiz}
            disabled={loading}
            accessible={true}
            accessibilityLabel={t('a11y.quiz.start_quiz', locale)}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>{t('buttons.start_quiz', locale)}</Text>}
          </TouchableOpacity>
        </View>
      )}

      {gameState === 'playing' && question && (
        <View>
          {/* Progress */}
          <View style={s.progress}>
            {questions.map((_, i) => (
              <View key={i} style={[s.bar, i < index ? s.barGreen : i === index ? s.barBlue : s.barGray]} />
            ))}
          </View>

          <View style={s.card}>
            {/* Daily quiz badge */}
            {question.isDaily && (
              <View style={s.dailyBadge}>
                <Text style={s.dailyBadgeText}>{t('quiz.daily_quiz', locale)}</Text>
              </View>
            )}

            <Text style={s.badge}>
              {sportToEmoji(question.sport)} {getSportLabel(question.sport, locale)} · {question.points} {t('quiz.pts', locale)}
            </Text>
            <Text style={s.questionText}>{question.question}</Text>

            {question.options.map((op: string, i: number) => {
              let bgColor = colors.border;
              let borderColor = colors.border;
              if (feedback) {
                if (i === feedback.correctAnswer) { bgColor = colors.green + '20'; borderColor = colors.green; }
                else if (i === selection && !feedback.correct) { bgColor = '#FEE2E2'; borderColor = '#F87171'; }
              } else if (i === selection) {
                bgColor = colors.blue + '15'; borderColor = colors.blue;
              }
              return (
                <TouchableOpacity
                  key={i}
                  style={[s.option, { backgroundColor: bgColor, borderColor }]}
                  onPress={() => answer(i)}
                  disabled={!!feedback}
                  accessible={true}
                  accessibilityLabel={
                    feedback
                      ? (i === feedback.correctAnswer
                        ? t('a11y.quiz.answer_correct', locale, { text: op })
                        : (i === selection && !feedback.correct
                          ? t('a11y.quiz.answer_incorrect', locale, { text: op })
                          : t('a11y.quiz.answer_option', locale, { index: String(i + 1), text: op })))
                      : t('a11y.quiz.answer_option', locale, { index: String(i + 1), text: op })
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === selection, disabled: !!feedback }}
                >
                  <Text style={s.optionLetter}>{String.fromCharCode(65 + i)}</Text>
                  <Text style={s.optionText}>{op}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {feedback && (
            <View style={[s.feedbackBox, feedback.correct ? s.feedbackOk : s.feedbackBad]}>
              <Text style={s.feedbackText}>
                {feedback.correct ? t('quiz.correct', locale) : t('quiz.incorrect', locale)}
              </Text>
            </View>
          )}

          {/* Related news link for daily questions — hidden until navigation is wired up
          {feedback && question.isDaily && question.relatedNewsId && (
            <TouchableOpacity
              style={s.relatedNewsLink}
              onPress={() => {
                // TODO: Open related news - deep link or in-app navigation
              }}
            >
              <Text style={s.relatedNewsText}>{t('quiz.read_news', locale)}</Text>
            </TouchableOpacity>
          )}
          */}

          {feedback && (
            <TouchableOpacity
              style={s.buttonBlue}
              onPress={next}
              accessible={true}
              accessibilityLabel={t('a11y.quiz.next_question', locale)}
              accessibilityRole="button"
            >
              <Text style={s.buttonText}>
                {index === questions.length - 1 ? t('quiz.view_results', locale) : t('buttons.next_question', locale)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {gameState === 'result' && (
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🏆</Text>
          <Text style={s.titleLarge}>{t('quiz.completed', locale)}</Text>
          <View style={[s.pointsBox, { backgroundColor: colors.green + '20' }]}>
            <Text style={s.pointsLabel}>{t('quiz.points_earned', locale)}</Text>
            <Text style={[s.pointsValue, { color: colors.green }]}>+{roundPoints}</Text>
          </View>
          <Text style={s.subtitle}>Total: {totalPoints} {t('quiz.pts', locale)}</Text>
          <TouchableOpacity
            style={s.buttonBlue}
            onPress={startQuiz}
            accessible={true}
            accessibilityLabel={t('a11y.quiz.start_quiz', locale)}
            accessibilityRole="button"
          >
            <Text style={s.buttonText}>{t('buttons.play_again', locale)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    center: { alignItems: 'center', paddingTop: 40 },
    titleLarge: { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 12 },
    subtitle: { fontSize: 15, color: colors.muted, marginTop: 4 },
    pointsBox: { backgroundColor: colors.yellow + '20', borderRadius: 16, padding: 20, alignItems: 'center', marginTop: 20, width: '100%' },
    pointsLabel: { fontSize: 13, color: colors.muted },
    pointsValue: { fontSize: 40, fontWeight: '700', color: colors.yellow },
    buttonGreen: { backgroundColor: colors.green, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, marginTop: 24, width: '100%', alignItems: 'center' },
    buttonBlue: { backgroundColor: colors.blue, paddingVertical: 14, borderRadius: 12, marginTop: 16, alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    progress: { flexDirection: 'row', gap: 6, marginBottom: 20 },
    bar: { flex: 1, height: 6, borderRadius: 3 },
    barGreen: { backgroundColor: colors.green },
    barBlue: { backgroundColor: colors.blue },
    barGray: { backgroundColor: colors.border },
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    dailyBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.yellow + '20',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.yellow,
    },
    dailyBadgeText: { fontSize: 11, fontWeight: '700', color: colors.text },
    badge: { fontSize: 12, color: colors.muted, backgroundColor: colors.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
    questionText: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 20 },
    option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 2, marginBottom: 10 },
    optionLetter: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, textAlign: 'center', lineHeight: 28, fontSize: 13, fontWeight: '700', marginRight: 12 },
    optionText: { fontSize: 14, fontWeight: '500', color: colors.text, flex: 1 },
    feedbackBox: { padding: 14, borderRadius: 12, marginTop: 12, borderWidth: 1 },
    feedbackOk: { backgroundColor: colors.green + '20', borderColor: colors.green + '40' },
    feedbackBad: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },  // red stays visible in both themes
    feedbackText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
    relatedNewsLink: {
      marginTop: 10,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: colors.blue + '15',
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.blue + '30',
    },
    relatedNewsText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.blue,
    },
  });
}
