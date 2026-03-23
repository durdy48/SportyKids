import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import type { QuizQuestion } from '@sportykids/shared';
import { COLORS, sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import { useUser } from '../lib/user-context';

const API_BASE = 'http://192.168.1.189:3001/api';

type GameState = 'start' | 'playing' | 'result';

export function QuizScreen() {
  const { user, locale } = useUser();
  const [gameState, setGameState] = useState<GameState>('start');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctAnswer: number } | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [roundPoints, setRoundPoints] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetch(`${API_BASE}/quiz/score/${user.id}`)
        .then((r) => r.json())
        .then((d) => setTotalPoints(d.totalPoints))
        .catch(console.error);
    }
  }, [user]);

  const startQuiz = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/quiz/questions?count=5`);
      const data = await res.json();
      setQuestions(data.questions);
      setIndex(0);
      setRoundPoints(0);
      setSelection(null);
      setFeedback(null);
      setGameState('playing');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const answer = async (option: number) => {
    if (feedback || !user) return;
    setSelection(option);
    try {
      const res = await fetch(`${API_BASE}/quiz/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, questionId: questions[index].id, answer: option }),
      });
      const data = await res.json();
      setFeedback(data);
      setRoundPoints((p) => p + data.pointsEarned);
    } catch (err) {
      console.error(err);
    }
  };

  const next = () => {
    if (index === questions.length - 1) {
      setTotalPoints((p) => p + roundPoints);
      setGameState('result');
      return;
    }
    setIndex(index + 1);
    setSelection(null);
    setFeedback(null);
  };

  if (!user) return null;

  const question = questions[index];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {gameState === 'start' && (
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🧠</Text>
          <Text style={s.titleLarge}>{t('quiz.title', locale)}</Text>
          <Text style={s.subtitle}>{t('quiz.subtitle', locale)}</Text>
          <View style={s.pointsBox}>
            <Text style={s.pointsLabel}>{t('quiz.total_score', locale)}</Text>
            <Text style={s.pointsValue}>{totalPoints} {t('quiz.pts', locale)}</Text>
          </View>
          <TouchableOpacity style={s.buttonGreen} onPress={startQuiz} disabled={loading}>
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
            <Text style={s.badge}>
              {sportToEmoji(question.sport)} {getSportLabel(question.sport, locale)} · {question.points} {t('quiz.pts', locale)}
            </Text>
            <Text style={s.questionText}>{question.question}</Text>

            {question.options.map((op: string, i: number) => {
              let bgColor = '#F3F4F6';
              let borderColor = '#E5E7EB';
              if (feedback) {
                if (i === feedback.correctAnswer) { bgColor = '#DCFCE7'; borderColor = COLORS.green; }
                else if (i === selection && !feedback.correct) { bgColor = '#FEE2E2'; borderColor = '#F87171'; }
              } else if (i === selection) {
                bgColor = '#EFF6FF'; borderColor = COLORS.blue;
              }
              return (
                <TouchableOpacity
                  key={i}
                  style={[s.option, { backgroundColor: bgColor, borderColor }]}
                  onPress={() => answer(i)}
                  disabled={!!feedback}
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

          {feedback && (
            <TouchableOpacity style={s.buttonBlue} onPress={next}>
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
          <View style={[s.pointsBox, { backgroundColor: '#DCFCE7' }]}>
            <Text style={s.pointsLabel}>{t('quiz.points_earned', locale)}</Text>
            <Text style={[s.pointsValue, { color: COLORS.green }]}>+{roundPoints}</Text>
          </View>
          <Text style={s.subtitle}>Total: {totalPoints} {t('quiz.pts', locale)}</Text>
          <TouchableOpacity style={s.buttonBlue} onPress={startQuiz}>
            <Text style={s.buttonText}>{t('buttons.play_again', locale)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  center: { alignItems: 'center', paddingTop: 40 },
  titleLarge: { fontSize: 28, fontWeight: '700', color: COLORS.darkText, marginTop: 12 },
  subtitle: { fontSize: 15, color: '#9CA3AF', marginTop: 4 },
  pointsBox: { backgroundColor: '#FEF9C3', borderRadius: 16, padding: 20, alignItems: 'center', marginTop: 20, width: '100%' },
  pointsLabel: { fontSize: 13, color: '#6B7280' },
  pointsValue: { fontSize: 40, fontWeight: '700', color: COLORS.yellow },
  buttonGreen: { backgroundColor: COLORS.green, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, marginTop: 24, width: '100%', alignItems: 'center' },
  buttonBlue: { backgroundColor: COLORS.blue, paddingVertical: 14, borderRadius: 12, marginTop: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  barGreen: { backgroundColor: COLORS.green },
  barBlue: { backgroundColor: COLORS.blue },
  barGray: { backgroundColor: '#E5E7EB' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  badge: { fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  questionText: { fontSize: 20, fontWeight: '700', color: COLORS.darkText, marginTop: 16, marginBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 2, marginBottom: 10 },
  optionLetter: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', textAlign: 'center', lineHeight: 28, fontSize: 13, fontWeight: '700', marginRight: 12 },
  optionText: { fontSize: 14, fontWeight: '500', color: COLORS.darkText, flex: 1 },
  feedbackBox: { padding: 14, borderRadius: 12, marginTop: 12, borderWidth: 1 },
  feedbackOk: { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
  feedbackBad: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  feedbackText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
