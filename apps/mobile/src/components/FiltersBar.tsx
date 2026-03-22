import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SPORTS, sportToEmoji, COLORS, t, getSportLabel } from '@sportykids/shared';
import { useUser } from '../lib/user-context';

interface FiltersBarProps {
  activeSport: string | null;
  onSportChange: (sport: string | null) => void;
}

export function FiltersBar({ activeSport, onSportChange }: FiltersBarProps) {
  const { locale } = useUser();

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

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#fff',
  },
});
