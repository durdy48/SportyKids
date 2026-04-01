import { View, Text, StyleSheet } from 'react-native';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

interface StreakCounterProps {
  currentStreak: number;
  longestStreak: number;
  locale: Locale;
}

export function StreakCounter({ currentStreak, longestStreak, locale }: StreakCounterProps) {
  if (currentStreak <= 0 && longestStreak <= 0) return null;

  return (
    <View style={styles.container} accessibilityLabel={t('a11y.streak.counter', locale, { days: String(currentStreak) })}>
      <View style={styles.streakBadge}>
        <Text style={styles.fireIcon} accessibilityLabel={t('a11y.streak.fire_emoji', locale)}>{'\uD83D\uDD25'}</Text>
        <Text style={styles.streakCount}>{currentStreak}</Text>
        <Text style={styles.streakLabel}>{t('streak.days', locale)}</Text>
      </View>
      {longestStreak > 0 && (
        <Text style={styles.bestStreak}>
          {t('streak.longest', locale)}: {longestStreak}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fireIcon: {
    fontSize: 18,
  },
  streakCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400E',
  },
  streakLabel: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
  },
  bestStreak: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '500',
  },
});
