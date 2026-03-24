import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { SPORTS, TEAMS, AGE_RANGES, COLORS, sportToEmoji, t, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
import type { AgeRange } from '@sportykids/shared';
import { createUser, fetchSources, setupParentalPin } from '../lib/api';
import { useUser } from '../lib/user-context';

const TOTAL_STEPS = 5;

const TIME_LIMIT_OPTIONS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '60 min' },
  { minutes: 90, label: '90 min' },
  { minutes: 120, label: '120 min' },
  { minutes: 0, label: '' }, // "no limit" — label set via i18n
];

const FORMAT_OPTIONS = [
  { id: 'news', emoji: '📰', labelKey: 'nav.news' },
  { id: 'reels', emoji: '🎬', labelKey: 'nav.reels' },
  { id: 'quiz', emoji: '🧠', labelKey: 'nav.quiz' },
];

export function OnboardingScreen() {
  const { setUser, setParentalProfile, locale } = useUser();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 - Profile
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);

  // Step 2 - Sports
  const [sports, setSports] = useState<string[]>([]);

  // Step 3 - Team
  const [team, setTeam] = useState('');

  // Step 4 - Sources
  const [sources, setSources] = useState<{ id: string; name: string; sport: string }[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]);

  // Step 5 - Parental PIN
  const [parentalPin, setParentalPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [allowedFormats, setAllowedFormats] = useState<string[]>(['news', 'reels', 'quiz']);
  const [maxDailyTime, setMaxDailyTime] = useState(0); // 0 = no limit

  useEffect(() => {
    fetchSources()
      .then(setSources)
      .catch(console.error);
  }, []);

  const toggleSport = (sport: string) =>
    setSports((prev) => prev.includes(sport) ? prev.filter((x) => x !== sport) : [...prev, sport]);

  const toggleFeed = (id: string) =>
    setSelectedFeeds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleFormat = (formatId: string) => {
    setAllowedFormats((prev) => {
      if (prev.includes(formatId)) {
        // Don't allow deselecting all
        if (prev.length <= 1) return prev;
        return prev.filter((f) => f !== formatId);
      }
      return [...prev, formatId];
    });
  };

  const canAdvance = () => {
    if (step === 1) return name.trim().length >= 2 && ageRange !== null;
    if (step === 2) return sports.length > 0;
    if (step === 5) {
      // PIN is optional at onboarding, but if entered must be valid
      if (parentalPin.length === 0) return true; // skip PIN
      return parentalPin.length === 4 && confirmPin.length === 4;
    }
    return true;
  };

  const complete = async () => {
    if (!ageRange) return;

    // Validate PIN if entered
    if (parentalPin.length > 0) {
      if (parentalPin !== confirmPin) {
        setPinError(t('onboarding.pin_mismatch', locale));
        return;
      }
      if (parentalPin.length !== 4) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const newUser = await createUser({
        name: name.trim(),
        age: AGE_RANGES[ageRange].min,
        favoriteSports: sports,
        favoriteTeam: team || undefined,
        selectedFeeds,
      });

      // Set up parental PIN if provided
      if (parentalPin.length === 4) {
        try {
          const profile = await setupParentalPin(newUser.id, parentalPin, {
            allowedFormats,
            maxDailyTimeMinutes: maxDailyTime > 0 ? maxDailyTime : undefined,
          });
          setParentalProfile(profile);
        } catch {
          // PIN setup failed but user was created — continue
          console.error('Parental PIN setup failed');
        }
      }

      setUser(newUser);
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

        {step === 5 && (
          <View style={s.stepContainer}>
            <Text style={s.emoji}>🔒</Text>
            <Text style={s.title}>{t('onboarding.step5_title', locale)}</Text>
            <Text style={s.subtitle}>{t('onboarding.step5_subtitle', locale)}</Text>

            {/* PIN creation */}
            <Text style={s.label}>{t('onboarding.pin_create', locale)}</Text>
            <TextInput
              style={s.pinInput}
              value={parentalPin}
              onChangeText={(text) => {
                setParentalPin(text.replace(/\D/g, '').slice(0, 4));
                setPinError('');
              }}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
              placeholder="····"
              placeholderTextColor="#ccc"
            />

            {parentalPin.length === 4 && (
              <>
                <Text style={s.label}>{t('onboarding.pin_confirm', locale)}</Text>
                <TextInput
                  style={s.pinInput}
                  value={confirmPin}
                  onChangeText={(text) => {
                    setConfirmPin(text.replace(/\D/g, '').slice(0, 4));
                    setPinError('');
                  }}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                  placeholder="····"
                  placeholderTextColor="#ccc"
                />
              </>
            )}

            {pinError ? <Text style={s.pinError}>{pinError}</Text> : null}

            {/* Allowed formats */}
            <Text style={[s.label, { marginTop: 20 }]}>{t('onboarding.formats_label', locale)}</Text>
            <View style={s.formatGrid}>
              {FORMAT_OPTIONS.map((f) => {
                const active = allowedFormats.includes(f.id);
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[s.formatChip, active && s.formatChipActive]}
                    onPress={() => toggleFormat(f.id)}
                  >
                    <Text style={{ fontSize: 20 }}>{f.emoji}</Text>
                    <Text style={[s.formatLabel, active && { color: '#fff' }]}>
                      {t(f.labelKey, locale)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Time limit */}
            <Text style={[s.label, { marginTop: 20 }]}>{t('onboarding.time_limit_label', locale)}</Text>
            <View style={s.timeLimitGrid}>
              {TIME_LIMIT_OPTIONS.map((opt) => {
                const active = maxDailyTime === opt.minutes;
                const label = opt.minutes === 0 ? t('onboarding.no_limit', locale) : opt.label;
                return (
                  <TouchableOpacity
                    key={opt.minutes}
                    style={[s.timeLimitChip, active && s.timeLimitActive]}
                    onPress={() => setMaxDailyTime(opt.minutes)}
                  >
                    <Text style={[s.timeLimitText, active && { color: '#fff' }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
              style={[s.buttonGreen, (submitting || !canAdvance()) && s.buttonDisabled]}
              onPress={complete}
              disabled={submitting || !canAdvance()}
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
  subtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 16, textAlign: 'center' },
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
  pinInput: {
    fontSize: 32, fontWeight: '700', textAlign: 'center', letterSpacing: 16,
    width: 200, paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: '#E5E7EB',
    marginBottom: 4,
  },
  pinError: { color: '#EF4444', fontSize: 13, marginTop: 4 },
  formatGrid: { flexDirection: 'row', gap: 10, width: '100%' },
  formatChip: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: 'transparent',
  },
  formatChipActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  formatLabel: { fontSize: 12, fontWeight: '600', color: '#4B5563', marginTop: 4 },
  timeLimitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  timeLimitChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F3F4F6', minWidth: '28%', alignItems: 'center',
  },
  timeLimitActive: { backgroundColor: COLORS.blue },
  timeLimitText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 32 },
  buttonPrimary: { flex: 1, backgroundColor: COLORS.blue, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonGreen: { flex: 1, backgroundColor: COLORS.green, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonSecondary: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonSecondaryText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.4 },
});
