import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import { SPORTS, TEAMS, AGE_RANGES, COLORS, sportToEmoji, t, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
import type { AgeRange } from '@sportykids/shared';
import { useUser } from '../lib/user-context';

const API_BASE = 'http://192.168.1.189:3001/api';
const TOTAL_STEPS = 4;

export function OnboardingScreen() {
  const { setUser, locale } = useUser();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [sports, setSports] = useState<string[]>([]);
  const [team, setTeam] = useState('');
  const [sources, setSources] = useState<{ id: string; name: string; sport: string }[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/news/fuentes/listado`)
      .then((r) => r.json())
      .then(setSources)
      .catch(console.error);
  }, []);

  const toggleSport = (sport: string) =>
    setSports((prev) => prev.includes(sport) ? prev.filter((x) => x !== sport) : [...prev, sport]);

  const toggleFeed = (id: string) =>
    setSelectedFeeds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const canAdvance = () => {
    if (step === 1) return name.trim().length >= 2 && ageRange !== null;
    if (step === 2) return sports.length > 0;
    return true;
  };

  const complete = async () => {
    if (!ageRange) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          age: AGE_RANGES[ageRange].min,
          favoriteSports: sports,
          favoriteTeam: team || undefined,
          selectedFeeds,
        }),
      });
      if (res.ok) setUser(await res.json());
    } catch (err) {
      console.error('Error creating user:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Progress */}
        <View style={s.progress}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View key={i} style={[s.bar, i < step && s.barActive]} />
          ))}
        </View>

        {step === 1 && (
          <View style={s.stepContainer}>
            <Text style={s.emoji}>👋</Text>
            <Text style={s.title}>{t('onboarding.step1_title', locale)}</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder={t('onboarding.name_placeholder', locale)}
              maxLength={50}
            />
            <Text style={s.label}>{t('onboarding.age_question', locale)}</Text>
            <View style={s.row}>
              {(Object.keys(AGE_RANGES) as AgeRange[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[s.chip, r === ageRange && s.chipActive]}
                  onPress={() => setAgeRange(r)}
                >
                  <Text style={[s.chipText, r === ageRange && s.chipTextActive]}>
                    {getAgeRangeLabel(r, locale)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={s.stepContainer}>
            <Text style={s.emoji}>🏆</Text>
            <Text style={s.title}>{t('onboarding.step2_title', locale)}</Text>
            <View style={s.grid}>
              {SPORTS.map((sport) => (
                <TouchableOpacity
                  key={sport}
                  style={[s.chip, sports.includes(sport) && s.chipGreen]}
                  onPress={() => toggleSport(sport)}
                >
                  <Text style={[s.chipText, sports.includes(sport) && s.chipTextActive]}>
                    {sportToEmoji(sport)} {getSportLabel(sport, locale)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={s.stepContainer}>
            <Text style={s.emoji}>⚽</Text>
            <Text style={s.title}>{t('onboarding.step3_title', locale)}</Text>
            <Text style={s.subtitle}>{t('onboarding.step3_subtitle', locale)}</Text>
            <View style={s.grid}>
              {TEAMS.map((t_) => (
                <TouchableOpacity
                  key={t_}
                  style={[s.chip, team === t_ && s.chipActive]}
                  onPress={() => setTeam(team === t_ ? '' : t_)}
                >
                  <Text style={[s.chipText, team === t_ && s.chipTextActive]}>{t_}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={s.stepContainer}>
            <Text style={s.emoji}>📰</Text>
            <Text style={s.title}>{t('onboarding.step4_title', locale)}</Text>
            <Text style={s.subtitle}>{t('onboarding.step4_subtitle', locale)}</Text>
            {sources.map((source) => (
              <TouchableOpacity
                key={source.id}
                style={[s.sourceChip, selectedFeeds.includes(source.id) && s.sourceActive]}
                onPress={() => toggleFeed(source.id)}
              >
                <Text style={s.chipText}>{source.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Buttons */}
        <View style={s.buttons}>
          {step > 1 && (
            <TouchableOpacity style={s.buttonSecondary} onPress={() => setStep(step - 1)}>
              <Text style={s.buttonSecondaryText}>{t('buttons.back', locale)}</Text>
            </TouchableOpacity>
          )}
          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[s.buttonPrimary, !canAdvance() && s.buttonDisabled]}
              onPress={() => canAdvance() && setStep(step + 1)}
              disabled={!canAdvance()}
            >
              <Text style={s.buttonPrimaryText}>{t('buttons.next', locale)}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.buttonGreen, submitting && s.buttonDisabled]}
              onPress={complete}
              disabled={submitting}
            >
              <Text style={s.buttonPrimaryText}>
                {submitting ? t('onboarding.creating_profile', locale) : t('buttons.start', locale)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 24, paddingBottom: 40 },
  progress: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  barActive: { backgroundColor: COLORS.blue },
  stepContainer: { alignItems: 'center' },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.darkText, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 16 },
  label: { fontSize: 14, color: '#6B7280', marginTop: 16, marginBottom: 8, alignSelf: 'flex-start' },
  input: { width: '100%', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16, backgroundColor: '#fff' },
  row: { flexDirection: 'row', gap: 10, width: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginTop: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', flex: 1, minWidth: '40%' },
  chipActive: { backgroundColor: COLORS.blue },
  chipGreen: { backgroundColor: COLORS.green },
  chipText: { fontSize: 14, fontWeight: '500', color: '#4B5563', textAlign: 'center' },
  chipTextActive: { color: '#fff' },
  sourceChip: { width: '100%', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', marginTop: 8, borderWidth: 2, borderColor: 'transparent' },
  sourceActive: { borderColor: COLORS.yellow, backgroundColor: '#FEFCE8' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 32 },
  buttonPrimary: { flex: 1, backgroundColor: COLORS.blue, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonGreen: { flex: 1, backgroundColor: COLORS.green, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonSecondary: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonSecondaryText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.4 },
});
