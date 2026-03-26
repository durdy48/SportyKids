'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SPORTS, TEAMS, AGE_RANGES, sportToEmoji, t, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
import type { AgeRange, RssSource } from '@sportykids/shared';
import { createUser, fetchSourceCatalog, addCustomSource, setupParentalPin } from '@/lib/api';
import { useUser } from '@/lib/user-context';

const TOTAL_STEPS = 5;

const TIME_PRESETS = [15, 30, 60, 90, 120, 0] as const;

const COUNTRY_FLAGS: Record<string, string> = {
  ES: '\u{1F1EA}\u{1F1F8}',
  GB: '\u{1F1EC}\u{1F1E7}',
  US: '\u{1F1FA}\u{1F1F8}',
  FR: '\u{1F1EB}\u{1F1F7}',
  IT: '\u{1F1EE}\u{1F1F9}',
  DE: '\u{1F1E9}\u{1F1EA}',
};

export function OnboardingWizard() {
  const router = useRouter();
  const { setUser, setParentalProfile, locale } = useUser();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [sports, setSports] = useState<string[]>([]);
  const [team, setTeam] = useState<string>('');
  const [catalogSources, setCatalogSources] = useState<RssSource[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Step 5: Parental
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [allowedFormats, setAllowedFormats] = useState<string[]>(['news', 'reels', 'quiz']);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(0); // 0 = no limit

  // Custom source form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [customSport, setCustomSport] = useState('');
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customError, setCustomError] = useState('');
  const [customSuccess, setCustomSuccess] = useState('');

  // Fetch catalog when entering step 4
  useEffect(() => {
    if (step === 4 && catalogSources.length === 0) {
      setCatalogLoading(true);
      fetchSourceCatalog()
        .then((data) => {
          setCatalogSources(data.sources);
          // Pre-select all sources that match the user's selected sports
          const relevantIds = data.sources
            .filter((s) => sports.includes(s.sport))
            .map((s) => s.id);
          setSelectedFeeds(relevantIds);
        })
        .catch(console.error)
        .finally(() => setCatalogLoading(false));
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sources grouped by sport → country (only sports selected in step 2)
  const sourcesBySport = useMemo(() => {
    const grouped: Record<string, Record<string, RssSource[]>> = {};
    for (const sport of sports) {
      const sportSources = catalogSources.filter((s) => s.sport === sport);
      if (sportSources.length > 0) {
        const byCountry: Record<string, RssSource[]> = {};
        for (const src of sportSources) {
          const country = src.country || 'XX';
          if (!byCountry[country]) byCountry[country] = [];
          byCountry[country].push(src);
        }
        grouped[sport] = byCountry;
      }
    }
    return grouped;
  }, [catalogSources, sports]);

  const toggleSport = (s: string) => {
    setSports((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const toggleFeed = (id: string) => {
    setSelectedFeeds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAllForSport = (sport: string) => {
    const sportSourceIds = catalogSources
      .filter((s) => s.sport === sport)
      .map((s) => s.id);
    setSelectedFeeds((prev) => {
      const withoutSport = prev.filter((id) => !sportSourceIds.includes(id));
      return [...withoutSport, ...sportSourceIds];
    });
  };

  const deselectAllForSport = (sport: string) => {
    const sportSourceIds = new Set(
      catalogSources.filter((s) => s.sport === sport).map((s) => s.id)
    );
    setSelectedFeeds((prev) => prev.filter((id) => !sportSourceIds.has(id)));
  };

  const areAllSelectedForSport = (sport: string): boolean => {
    const sportSourceIds = catalogSources
      .filter((s) => s.sport === sport)
      .map((s) => s.id);
    return sportSourceIds.length > 0 && sportSourceIds.every((id) => selectedFeeds.includes(id));
  };

  const handleAddCustomSource = async () => {
    if (!customUrl.trim() || !customName.trim() || !customSport) return;

    setCustomSubmitting(true);
    setCustomError('');
    setCustomSuccess('');

    try {
      const newSource = await addCustomSource({
        url: customUrl.trim(),
        name: customName.trim(),
        sport: customSport,
        userId: '', // Will be set server-side or after user creation
      });
      setCatalogSources((prev) => [...prev, newSource]);
      setSelectedFeeds((prev) => [...prev, newSource.id]);
      setCustomSuccess(t('sources.custom_success', locale, { count: '0' }));
      setCustomUrl('');
      setCustomName('');
      setCustomSport('');
      setTimeout(() => {
        setShowCustomForm(false);
        setCustomSuccess('');
      }, 2000);
    } catch {
      setCustomError(t('sources.custom_error_invalid', locale));
    } finally {
      setCustomSubmitting(false);
    }
  };

  const toggleAllowedFormat = (format: string) => {
    setAllowedFormats((prev) => {
      if (prev.includes(format)) {
        const next = prev.filter((f) => f !== format);
        return next.length === 0 ? prev : next; // at least one
      }
      return [...prev, format];
    });
  };

  const canAdvance = () => {
    if (step === 1) return name.trim().length >= 2 && ageRange !== null;
    if (step === 2) return sports.length > 0;
    if (step === 3) return true; // Team is optional
    if (step === 4) return selectedFeeds.length >= 1;
    if (step === 5) return pin.length === 4 && pin === pinConfirm;
    return false;
  };

  const complete = async () => {
    if (!ageRange) return;
    if (pin !== pinConfirm) {
      setPinError(t('onboarding.pin_mismatch', locale));
      return;
    }
    setSubmitting(true);
    try {
      const age = AGE_RANGES[ageRange].min;
      const user = await createUser({
        name: name.trim(),
        age,
        favoriteSports: sports,
        favoriteTeam: team || undefined,
        selectedFeeds,
      });
      // Set up parental controls
      const parentalProfile = await setupParentalPin(user.id, pin, {
        allowedFormats,
        maxDailyTimeMinutes: timeLimitMinutes || undefined,
      });
      setUser(user);
      setParentalProfile(parentalProfile);
      router.push('/');
    } catch (err) {
      console.error('Error creating user:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-lg max-w-md w-full p-8">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i < step ? 'bg-[var(--color-blue)]' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Name and age */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-4xl">👋</span>
              <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mt-3">
                {t('onboarding.step1_title', locale)}
              </h2>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('onboarding.name_placeholder', locale)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
              maxLength={50}
            />
            <div>
              <p className="text-sm text-gray-500 mb-3">{t('onboarding.age_question', locale)}</p>
              <div className="flex gap-3">
                {(Object.keys(AGE_RANGES) as AgeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setAgeRange(range)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                      range === ageRange
                        ? 'bg-[var(--color-blue)] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {getAgeRangeLabel(range, locale)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Favorite sports */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-4xl">🏆</span>
              <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mt-3">
                {t('onboarding.step2_title', locale)}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{t('onboarding.step2_subtitle', locale)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SPORTS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSport(s)}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-colors ${
                    sports.includes(s)
                      ? 'bg-[var(--color-green)] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {sportToEmoji(s)} {getSportLabel(s, locale)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Favorite team */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-4xl">⚽</span>
              <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mt-3">
                {t('onboarding.step3_title', locale)}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{t('onboarding.step3_subtitle', locale)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {TEAMS.map((tm) => (
                <button
                  key={tm}
                  onClick={() => setTeam(team === tm ? '' : tm)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors text-left ${
                    team === tm
                      ? 'bg-[var(--color-blue)] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tm}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: News sources (catalog) */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-4xl">📰</span>
              <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mt-3">
                {t('sources.catalog_title', locale)}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{t('sources.catalog_subtitle', locale)}</p>
            </div>

            {/* Selected count */}
            <p className="text-center text-sm font-medium text-[var(--color-blue)]">
              {t('sources.selected_count', locale, { count: String(selectedFeeds.length) })}
            </p>

            {catalogLoading ? (
              <div className="text-center py-8 text-gray-400">
                {t('buttons.loading', locale)}
              </div>
            ) : (
              <div className="space-y-5 max-h-72 overflow-y-auto">
                {Object.entries(sourcesBySport).map(([sport, countrySources]) => (
                  <div key={sport}>
                    {/* Sport group header */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-[var(--color-text)]">
                        {sportToEmoji(sport)} {getSportLabel(sport, locale)}
                      </h3>
                      <button
                        onClick={() =>
                          areAllSelectedForSport(sport)
                            ? deselectAllForSport(sport)
                            : selectAllForSport(sport)
                        }
                        className="text-xs text-[var(--color-blue)] hover:underline"
                      >
                        {areAllSelectedForSport(sport)
                          ? t('sources.deselect_all', locale)
                          : t('sources.select_all', locale)}
                      </button>
                    </div>

                    {/* Sources grouped by country within this sport */}
                    <div className="space-y-3">
                      {Object.entries(countrySources).map(([country, sources]) => (
                        <div key={country}>
                          <p className="text-xs text-gray-400 font-medium mb-1.5 flex items-center gap-1.5">
                            <span>{COUNTRY_FLAGS[country] || '\u{1F30D}'}</span>
                            {t(`sources.country_${country}`, locale) !== `sources.country_${country}`
                              ? t(`sources.country_${country}`, locale)
                              : country}
                          </p>
                          <div className="space-y-1.5">
                            {sources.map((src) => (
                              <button
                                key={src.id}
                                onClick={() => toggleFeed(src.id)}
                                className={`w-full py-2.5 px-3 rounded-xl text-sm transition-colors text-left flex items-start gap-2 ${
                                  selectedFeeds.includes(src.id)
                                    ? 'bg-[var(--color-yellow)]/20 border-2 border-[var(--color-yellow)]'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-[var(--color-text)] truncate">
                                      {src.name}
                                    </span>
                                    {src.isCustom && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-blue)]/10 text-[var(--color-blue)] font-medium flex-shrink-0">
                                        {t('sources.custom_badge', locale)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-400 truncate mt-0.5">
                                    {src.description}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add custom source */}
            {!showCustomForm ? (
              <button
                onClick={() => setShowCustomForm(true)}
                className="w-full py-2.5 rounded-xl text-sm font-medium border-2 border-dashed border-gray-300 text-gray-500 hover:border-[var(--color-blue)] hover:text-[var(--color-blue)] transition-colors"
              >
                + {t('sources.add_custom', locale)}
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder={t('sources.custom_url_placeholder', locale)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
                />
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={t('sources.custom_name_placeholder', locale)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
                />
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {t('sources.custom_sport_label', locale)}
                  </label>
                  <select
                    value={customSport}
                    onChange={(e) => setCustomSport(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent bg-white"
                  >
                    <option value="">--</option>
                    {sports.map((s) => (
                      <option key={s} value={s}>
                        {getSportLabel(s, locale)}
                      </option>
                    ))}
                  </select>
                </div>

                {customError && (
                  <p className="text-xs text-red-500">{customError}</p>
                )}
                {customSuccess && (
                  <p className="text-xs text-[var(--color-green)]">{customSuccess}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomError('');
                      setCustomSuccess('');
                    }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                  >
                    {t('buttons.cancel', locale)}
                  </button>
                  <button
                    onClick={handleAddCustomSource}
                    disabled={customSubmitting || !customUrl.trim() || !customName.trim() || !customSport}
                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-[var(--color-blue)] text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {customSubmitting
                      ? t('sources.custom_validating', locale)
                      : t('sources.custom_add_button', locale)}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Parental PIN + formats + time limit */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-4xl">{'\u{1F512}'}</span>
              <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mt-3">
                {t('onboarding.step5_title', locale)}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{t('onboarding.step5_subtitle', locale)}</p>
            </div>

            {/* PIN creation */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-[var(--color-text)] block">
                {t('onboarding.pin_create', locale)}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(v);
                  setPinError('');
                }}
                placeholder="----"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-[var(--color-text)] block">
                {t('onboarding.pin_confirm', locale)}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinConfirm}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPinConfirm(v);
                  setPinError('');
                }}
                placeholder="----"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
              />
              {pinError && <p className="text-red-500 text-xs">{pinError}</p>}
              {pin.length === 4 && pinConfirm.length === 4 && pin !== pinConfirm && (
                <p className="text-red-500 text-xs">{t('onboarding.pin_mismatch', locale)}</p>
              )}
            </div>

            {/* Allowed formats */}
            <div>
              <label className="text-sm font-medium text-[var(--color-text)] block mb-2">
                {t('onboarding.formats_label', locale)}
              </label>
              <div className="flex gap-3">
                {[
                  { id: 'news', label: t('nav.news', locale), emoji: '\u{1F4F0}' },
                  { id: 'reels', label: t('nav.reels', locale), emoji: '\u{1F3AC}' },
                  { id: 'quiz', label: t('nav.quiz', locale), emoji: '\u{1F9E0}' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => toggleAllowedFormat(fmt.id)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                      allowedFormats.includes(fmt.id)
                        ? 'bg-[var(--color-green)] text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {fmt.emoji} {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time limit */}
            <div>
              <label className="text-sm font-medium text-[var(--color-text)] block mb-2">
                {t('onboarding.time_limit_label', locale)}
              </label>
              <div className="flex gap-2 flex-wrap">
                {TIME_PRESETS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setTimeLimitMinutes(mins)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      timeLimitMinutes === mins
                        ? 'bg-[var(--color-blue)] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {mins === 0 ? t('onboarding.no_limit', locale) : `${mins} min`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              {t('buttons.back', locale)}
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-[var(--color-blue)] text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('buttons.next', locale)}
            </button>
          ) : (
            <button
              onClick={complete}
              disabled={submitting || !canAdvance()}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-[var(--color-green)] text-white hover:bg-green-600 transition-colors disabled:opacity-40"
            >
              {submitting ? t('onboarding.creating_profile', locale) : t('buttons.start', locale)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
