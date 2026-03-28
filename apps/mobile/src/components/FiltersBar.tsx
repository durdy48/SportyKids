import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SPORTS, sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import { useUser } from '../lib/user-context';

interface FiltersBarProps {
  activeSport: string | null;
  onSportChange: (sport: string | null) => void;
}

export function FiltersBar({ activeSport, onSportChange }: FiltersBarProps) {
  const { locale, colors } = useUser();
  const styles = createStyles(colors);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity
        style={[styles.chip, !activeSport && styles.chipActive]}
        onPress={() => onSportChange(null)}
      >
        <Text style={[styles.chipText, !activeSport && styles.chipTextActive]}>
          {t('filters.all', locale)}
        </Text>
      </TouchableOpacity>

      {SPORTS.map((sport) => (
        <TouchableOpacity
          key={sport}
          style={[styles.chip, sport === activeSport && styles.chipActive]}
          onPress={() => onSportChange(sport === activeSport ? null : sport)}
        >
          <Text style={[styles.chipText, sport === activeSport && styles.chipTextActive]}>
            {sportToEmoji(sport)} {getSportLabel(sport, locale)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.blue,
      borderColor: colors.blue,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.muted,
    },
    chipTextActive: {
      color: '#fff',
    },
  });
}
