import { View, Text, StyleSheet } from 'react-native';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';

export type LimitType = 'limit_reached' | 'format_blocked' | 'sport_blocked' | 'schedule_locked' | 'news_limit_reached' | 'reels_limit_reached' | 'quiz_limit_reached';

interface LimitReachedProps {
  type?: LimitType;
  locale: Locale;
  colors: ThemeColors;
  allowedHoursStart?: number;
  allowedHoursEnd?: number;
}

const EMOJIS: Record<LimitType, string> = {
  limit_reached: '\u{1F634}',
  format_blocked: '\u{1F6AB}',
  sport_blocked: '\u{26BD}',
  schedule_locked: '\u{1F319}',
  news_limit_reached: '\u{1F4F0}',
  reels_limit_reached: '\u{1F3AC}',
  quiz_limit_reached: '\u{1F9E0}',
};

const MESSAGE_KEYS: Record<LimitType, { title: string; message: string }> = {
  limit_reached: { title: 'limit.reached_title', message: 'limit.reached_message' },
  format_blocked: { title: 'limit.reached_title', message: 'limit.format_blocked' },
  sport_blocked: { title: 'limit.reached_title', message: 'limit.sport_blocked' },
  schedule_locked: { title: 'schedule.locked_title', message: 'schedule.locked_message' },
  news_limit_reached: { title: 'limit.reached_title', message: 'limit.news_reached_message' },
  reels_limit_reached: { title: 'limit.reached_title', message: 'limit.reels_reached_message' },
  quiz_limit_reached: { title: 'limit.reached_title', message: 'limit.quiz_reached_message' },
};

export function LimitReached({ type = 'limit_reached', locale, colors, allowedHoursStart, allowedHoursEnd }: LimitReachedProps) {
  const keys = MESSAGE_KEYS[type];
  const emoji = EMOJIS[type];

  let message = t(keys.message, locale);
  if (type === 'schedule_locked' && allowedHoursStart !== undefined && allowedHoursEnd !== undefined) {
    message = message
      .replace('{start}', String(allowedHoursStart))
      .replace('{end}', String(allowedHoursEnd));
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]} accessibilityRole="alert" accessibilityLabel={t('a11y.limit.time_exceeded', locale)}>
      <Text style={s.emoji} accessibilityLabel={t('a11y.limit.time_exceeded', locale)}>{emoji}</Text>
      <Text style={[s.title, { color: colors.text }]} accessibilityRole="header">{t(keys.title, locale)}</Text>
      <Text style={[s.message, { color: colors.muted }]}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
