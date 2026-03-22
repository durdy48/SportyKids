'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SPORTS, TEAMS, AGE_RANGES, sportToEmoji, t, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
import type { AgeRange } from '@sportykids/shared';
import { createUser, fetchSources, type RssSourceInfo } from '@/lib/api';
import { useUser } from '@/lib/user-context';

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const router = useRouter();
  const { setUser, locale } = useUser();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [sports, setSports] = useState<string[]>([]);
  const [team, setTeam] = useState<string>('');
  const [sources, setSources] = useState<RssSourceInfo[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]);

  useEffect(() => {
    fetchSources().then(setSources).catch(console.error);
  }, []);

  const toggleSport = (s: string) => {
    setSports((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const toggleFeed = (id: string) => {
    setSelectedFeeds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const canAdvance = () => {
    if (step === 1) return name.trim().length >= 2 && ageRange !== null;
    if (step === 2) return sports.length > 0;
    if (step === 3) return true; // Team is optional
    if (step === 4) return true; // Feeds are optional
    return false;
  };

  const complete = async () => {
    if (!ageRange) return;
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
      setUser(user);
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

        {/* Step 4: News sources */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-4xl">📰</span>
              <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mt-3">
                {t('onboarding.step4_title', locale)}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{t('onboarding.step4_subtitle', locale)}</p>
            </div>
            <div className="space-y-2">
              {sources.map((src) => (
                <button
                  key={src.id}
                  onClick={() => toggleFeed(src.id)}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-medium transition-colors text-left flex justify-between items-center ${
                    selectedFeeds.includes(src.id)
                      ? 'bg-[var(--color-yellow)]/20 border-2 border-[var(--color-yellow)]'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                  }`}
                >
                  <span>{src.name}</span>
                  <span className="text-xs text-gray-400">{sportToEmoji(src.sport)}</span>
                </button>
              ))}
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
              disabled={submitting}
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
