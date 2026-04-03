import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SPORTS, AGE_RANGES, SPORT_ENTITIES, sportToEmoji, t, getSportLabel, getAgeRangeLabel, inferCountryFromLocale, getSourceIdsForEntities } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import type { AgeRange, RssSource, SportEntity } from '@sportykids/shared';
import { createUser, fetchSourceCatalog, setupParentalPin } from '../lib/api';
import { useUser } from '../lib/user-context';
import { WEB_BASE } from '../config';

const COUNTRY_FLAGS: Record<string, string> = {
  ES: '\u{1F1EA}\u{1F1F8}',
  GB: '\u{1F1EC}\u{1F1E7}',
  US: '\u{1F1FA}\u{1F1F8}',
  FR: '\u{1F1EB}\u{1F1F7}',
  IT: '\u{1F1EE}\u{1F1F9}',
  DE: '\u{1F1E9}\u{1F1EA}',
};

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

const LOCALE_OPTIONS = [
  { value: 'es' as const, flag: '\u{1F1EA}\u{1F1F8}', label: 'Espa\u00f1ol' },
  { value: 'en' as const, flag: '\u{1F1EC}\u{1F1E7}', label: 'English' },
];

export function OnboardingScreen() {
  const { setUser, setParentalProfile, locale, setLocale, colors } = useUser();
  const s = createStyles(colors);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 - Profile
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);

  // Step 2 - Sports
  const [sports, setSports] = useState<string[]>([]);

  // Step 3 - Entities
  const [selectedEntities, setSelectedEntities] = useState<SportEntity[]>([]);

  // Step 4 - Sources
  const [sources, setSources] = useState<RssSource[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Step 5 - Parental PIN
  const [parentalPin, setParentalPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [allowedFormats, setAllowedFormats] = useState<string[]>(['news', 'reels', 'quiz']);
  const [maxDailyTime, setMaxDailyTime] = useState(0); // 0 = no limit

  useEffect(() => {
    fetchSourceCatalog()
      .then((catalog) => setSources(catalog.sources))
      // eslint-disable-next-line no-console
      .catch(console.error);
  }, []);

  // Auto-pre-select sources matching selected sports when entering step 4
  useEffect(() => {
    if (step === 4 && selectedFeeds.length === 0 && sources.length > 0 && sports.length > 0) {
      const matching = sources
        .filter((s) => s.active && sports.includes(s.sport))
        .map((s) => s.id);
      const entityIds = getSourceIdsForEntities(sources, selectedEntities);
      const merged = Array.from(new Set([...matching, ...entityIds]));
      setSelectedFeeds(merged);
    }
  // `selectedEntities` is intentionally omitted from deps: the effect is guarded by
  // `selectedFeeds.length === 0`, so it runs exactly once on step 4 entry. At that
  // point, `selectedEntities` already reflects the user's current selections from step 3.
  // If navigation ever becomes non-linear, this guard would need revisiting.
  }, [step, sources, sports]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group sources by country, filtered by selected sports and search query
  const groupedSources = useMemo(() => {
    const sportsSet = new Set(sports);
    const query = searchQuery.toLowerCase().trim();

    const filtered = sources.filter((s) => {
      if (!s.active) return false;
      if (!sportsSet.has(s.sport)) return false;
      if (query && !s.name.toLowerCase().includes(query)) return false;
      return true;
    });

    const byCountry: Record<string, RssSource[]> = {};
    for (const source of filtered) {
      const country = source.country || 'OTHER';
      if (!byCountry[country]) byCountry[country] = [];
      byCountry[country].push(source);
    }

    // Sort countries: user's locale country first, then alphabetically
    const countryOrder = Object.keys(byCountry).sort((a, b) => {
      const userCountry = inferCountryFromLocale(locale);
      if (a === userCountry) return -1;
      if (b === userCountry) return 1;
      return a.localeCompare(b);
    });

    return countryOrder.map((country) => ({
      country,
      title: `${COUNTRY_FLAGS[country] || '\u{1F30D}'} ${t(`sources.country_${country}`, locale) || country}`,
      data: byCountry[country],
    }));
  }, [sources, sports, searchQuery, locale]);

  const toggleSport = (sport: string) =>
    setSports((prev) => prev.includes(sport) ? prev.filter((x) => x !== sport) : [...prev, sport]);

  const visibleEntities = useMemo(
    () => sports.flatMap((sport) => SPORT_ENTITIES[sport] ?? []),
    [sports]
  );

  const toggleEntity = (entity: SportEntity) => {
    setSelectedEntities((prev) => {
      const exists = prev.some((e) => e.feedQuery === entity.feedQuery);
      return exists ? prev.filter((e) => e.feedQuery !== entity.feedQuery) : [...prev, entity];
    });
  };

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
      const inferredCountry = inferCountryFromLocale(locale);
      const newUser = await createUser({
        name: name.trim(),
        age: AGE_RANGES[ageRange].min,
        favoriteSports: sports,
        favoriteTeam: selectedEntities[0]?.name ?? undefined,
        selectedFeeds,
        locale,
        country: inferredCountry,
        ageGateCompleted: true,
        consentGiven: true,
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
          // eslint-disable-next-line no-console
          console.error('Parental PIN setup failed');
        }
      }

      setUser(newUser);
    } catch (err) {
      // eslint-disable-next-line no-console
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

            {/* Language selector */}
            <Text style={s.label}>{t('settings.language', locale)}</Text>
            <View style={s.row}>
              {LOCALE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.chip, locale === opt.value && s.chipActive]}
                  onPress={() => setLocale(opt.value)}
                  accessible={true}
                  accessibilityLabel={t('a11y.navigation.language_toggle', locale, { language: opt.label })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: locale === opt.value }}
                >
                  <Text style={[s.chipText, locale === opt.value && s.chipTextActive]}>
                    {opt.flag} {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[s.input, { marginTop: 16 }]}
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
                  accessible={true}
                  accessibilityLabel={t('a11y.onboarding.select_age', locale, { range: getAgeRangeLabel(r, locale) })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: r === ageRange }}
                >
                  <Text style={[s.chipText, r === ageRange && s.chipTextActive]}>
                    {getAgeRangeLabel(r, locale)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Legal links */}
            <View style={s.legalRow}>
              <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`${WEB_BASE}/privacy?locale=${locale}`)} accessibilityLabel={t('a11y.legal.open_privacy', locale)} accessibilityRole="link">
                <Text style={s.legalLink}>{t('legal.privacy_policy', locale)}</Text>
              </TouchableOpacity>
              <Text style={s.legalDot}> · </Text>
              <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`${WEB_BASE}/terms?locale=${locale}`)} accessibilityLabel={t('a11y.legal.open_terms', locale)} accessibilityRole="link">
                <Text style={s.legalLink}>{t('legal.terms_of_service', locale)}</Text>
              </TouchableOpacity>
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
                  accessible={true}
                  accessibilityLabel={t(sports.includes(sport) ? 'a11y.onboarding.deselect_sport' : 'a11y.onboarding.select_sport', locale, { sport: getSportLabel(sport, locale) })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sports.includes(sport) }}
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
            <Text style={s.emoji}>⭐</Text>
            <Text style={s.title}>{t('onboarding.step3_title', locale)}</Text>
            <Text style={s.subtitle}>{t('onboarding.step3_subtitle', locale)}</Text>
            {visibleEntities.length === 0 ? (
              <Text style={s.subtitle}>{t('onboarding.step3_no_entities', locale)}</Text>
            ) : (
            <View style={s.grid}>
              {visibleEntities.map((entity) => {
                const isSelected = selectedEntities.some(
                  (e) => e.feedQuery === entity.feedQuery
                );
                return (
                  <TouchableOpacity
                    key={entity.feedQuery}
                    style={[s.chip, isSelected && s.chipActive]}
                    onPress={() => toggleEntity(entity)}
                    accessible={true}
                    accessibilityLabel={t('a11y.onboarding.select_entity', locale, {
                      entity: entity.name,
                    })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[s.chipText, isSelected && s.chipTextActive]}>
                      {entity.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            )}
          </View>
        )}

        {step === 4 && (
          <View style={s.stepContainer}>
            <Text style={s.emoji}>📰</Text>
            <Text style={s.title}>{t('sources.catalog_title', locale)}</Text>
            <Text style={s.subtitle}>{t('sources.catalog_subtitle', locale)}</Text>

            {/* Selected count badge */}
            <View style={s.selectedBadge}>
              <Text style={s.selectedBadgeText}>
                {t('sources.selected_count', locale, { count: String(selectedFeeds.length) })}
              </Text>
            </View>

            {/* Search input */}
            <TextInput
              style={s.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('search.placeholder', locale)}
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />

            {/* Grouped source list */}
            {groupedSources.map((section) => (
              <View key={section.country} style={s.countrySection}>
                <Text style={s.countrySectionTitle}>{section.title}</Text>
                {section.data.map((source) => {
                  const selected = selectedFeeds.includes(source.id);
                  return (
                    <TouchableOpacity
                      key={source.id}
                      style={[s.sourceChip, selected && s.sourceActive]}
                      onPress={() => toggleFeed(source.id)}
                      accessible={true}
                      accessibilityLabel={t('a11y.onboarding.toggle_source', locale, { source: source.name, state: selected ? t('a11y.catalog.source_enabled', locale) : t('a11y.catalog.source_disabled', locale) })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <View style={s.sourceRow}>
                        <View style={s.sourceInfo}>
                          <Text style={[s.sourceNameText, selected && s.sourceNameSelected]}>
                            {source.name}
                          </Text>
                          {source.description ? (
                            <Text style={s.sourceDesc} numberOfLines={1}>
                              {source.description}
                            </Text>
                          ) : null}
                        </View>
                        <View style={[s.sourceSportBadge, { backgroundColor: selected ? colors.yellow : colors.border }]}>
                          <Text style={s.sourceSportText}>
                            {sportToEmoji(source.sport)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            {groupedSources.length === 0 && searchQuery.length > 0 && (
              <Text style={s.noResults}>{t('search.no_results', locale, { query: searchQuery })}</Text>
            )}
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
                    accessible={true}
                    accessibilityLabel={t('a11y.onboarding.toggle_format', locale, { format: t(f.labelKey, locale), state: active ? t('parental.enabled', locale) : t('parental.blocked', locale) })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
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
                    accessible={true}
                    accessibilityLabel={opt.minutes === 0 ? t('a11y.onboarding.no_limit', locale) : t('a11y.onboarding.select_time_limit', locale, { time: label })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
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
            <TouchableOpacity
              style={s.buttonSecondary}
              onPress={() => setStep(step - 1)}
              accessible={true}
              accessibilityLabel={t('a11y.common.back', locale)}
              accessibilityRole="button"
            >
              <Text style={s.buttonSecondaryText}>{t('buttons.back', locale)}</Text>
            </TouchableOpacity>
          )}
          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[s.buttonPrimary, !canAdvance() && s.buttonDisabled]}
              onPress={() => canAdvance() && setStep(step + 1)}
              disabled={!canAdvance()}
              accessible={true}
              accessibilityLabel={t('a11y.onboarding.next', locale)}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAdvance() }}
            >
              <Text style={s.buttonPrimaryText}>{t('buttons.next', locale)}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.buttonGreen, (submitting || !canAdvance()) && s.buttonDisabled]}
              onPress={complete}
              disabled={submitting || !canAdvance()}
              accessible={true}
              accessibilityLabel={t('buttons.start', locale)}
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting || !canAdvance() }}
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingBottom: 40 },
  progress: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border },
  barActive: { backgroundColor: colors.blue },
  stepContainer: { alignItems: 'center' },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 14, color: colors.muted, marginTop: 16, marginBottom: 8, alignSelf: 'flex-start' },
  input: { width: '100%', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, fontSize: 16, backgroundColor: colors.surface, color: colors.text },
  row: { flexDirection: 'row', gap: 10, width: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginTop: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.border, flex: 1, minWidth: '40%' },
  chipActive: { backgroundColor: colors.blue },
  chipGreen: { backgroundColor: colors.green },
  chipText: { fontSize: 14, fontWeight: '500', color: colors.muted, textAlign: 'center' },
  chipTextActive: { color: '#fff' },
  selectedBadge: {
    backgroundColor: colors.blue, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'center', marginBottom: 12,
  },
  selectedBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  searchInput: {
    width: '100%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, fontSize: 15, backgroundColor: colors.surface, color: colors.text, marginBottom: 16,
  },
  countrySection: { width: '100%', marginBottom: 12 },
  countrySectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: 4 },
  sourceChip: { width: '100%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.border, marginTop: 6, borderWidth: 2, borderColor: 'transparent' },
  sourceActive: { borderColor: colors.yellow, backgroundColor: colors.yellow + '15' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourceInfo: { flex: 1, marginRight: 8 },
  sourceNameText: { fontSize: 14, fontWeight: '500', color: colors.muted },
  sourceNameSelected: { fontWeight: '600', color: colors.text },
  sourceDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sourceSportBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sourceSportText: { fontSize: 14 },
  noResults: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 20 },
  pinInput: {
    fontSize: 32, fontWeight: '700', textAlign: 'center', letterSpacing: 16,
    width: 200, paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: colors.border,
    marginBottom: 4, color: colors.text,
  },
  pinError: { color: '#EF4444', fontSize: 13, marginTop: 4 },
  formatGrid: { flexDirection: 'row', gap: 10, width: '100%' },
  formatChip: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.border, borderWidth: 2, borderColor: 'transparent',
  },
  formatChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  formatLabel: { fontSize: 12, fontWeight: '600', color: colors.muted, marginTop: 4 },
  timeLimitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  timeLimitChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.border, minWidth: '28%', alignItems: 'center',
  },
  timeLimitActive: { backgroundColor: colors.blue },
  timeLimitText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  legalLink: { fontSize: 13, color: colors.blue, textDecorationLine: 'underline' },
  legalDot: { fontSize: 13, color: colors.muted },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 32 },
  buttonPrimary: { flex: 1, backgroundColor: colors.blue, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonGreen: { flex: 1, backgroundColor: colors.green, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonSecondary: { flex: 1, backgroundColor: colors.border, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonSecondaryText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.4 },
  });
}
