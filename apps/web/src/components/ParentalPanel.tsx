'use client';

import { useState, useEffect } from 'react';
import type { ParentalProfile } from '@sportykids/shared';
import { SPORTS, sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import { updateParentalProfile, fetchActivity } from '@/lib/api';
import { useUser } from '@/lib/user-context';

const FORMATS = [
  { id: 'news', key: 'nav.news', emoji: '📰' },
  { id: 'reels', key: 'nav.reels', emoji: '🎬' },
  { id: 'quiz', key: 'nav.quiz', emoji: '🧠' },
] as const;

interface ParentalPanelProps {
  profile: ParentalProfile;
}

export function ParentalPanel({ profile: initialProfile }: ParentalPanelProps) {
  const { user, setParentalProfile, locale } = useUser();
  const [profile, setProfile] = useState(initialProfile);
  const [activity, setActivity] = useState<{ news_viewed: number; reels_viewed: number; quizzes_played: number; totalPoints: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchActivity(user.id).then(setActivity).catch(console.error);
    }
  }, [user]);

  const toggleFormat = async (format: string) => {
    if (!user) return;
    const formats = profile.allowedFormats.includes(format as 'news' | 'reels' | 'quiz')
      ? profile.allowedFormats.filter((f) => f !== format)
      : [...profile.allowedFormats, format as 'news' | 'reels' | 'quiz'];

    // Don't allow empty
    if (formats.length === 0) return;

    setSaving(true);
    try {
      const updated = await updateParentalProfile(user.id, { allowedFormats: formats });
      setProfile(updated);
      setParentalProfile(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const changeTime = async (minutes: number) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateParentalProfile(user.id, { maxDailyTimeMinutes: minutes });
      setProfile(updated);
      setParentalProfile(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
            🔒 {t('parental.control', locale)}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {t('parental.manage_content', locale, { name: user?.name ?? '' })}
          </p>
        </div>
        {saving && <span className="text-xs text-gray-400">{t('buttons.saving', locale)}</span>}
      </div>

      {/* Activity summary */}
      {activity && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[var(--color-text)] mb-4">{t('parental.weekly_activity', locale)}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[var(--color-blue)]">{activity.news_viewed}</p>
              <p className="text-xs text-gray-500 mt-1">{t('parental.news_read', locale)}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{activity.reels_viewed}</p>
              <p className="text-xs text-gray-500 mt-1">{t('parental.reels_viewed', locale)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[var(--color-green)]">{activity.quizzes_played}</p>
              <p className="text-xs text-gray-500 mt-1">{t('parental.quizzes_played', locale)}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[var(--color-yellow)]">{activity.totalPoints}</p>
              <p className="text-xs text-gray-500 mt-1">{t('parental.total_points', locale)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Allowed formats */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-[var(--color-text)] mb-4">{t('parental.allowed_formats', locale)}</h3>
        <div className="space-y-3">
          {FORMATS.map((f) => {
            const active = profile.allowedFormats.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggleFormat(f.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${
                  active ? 'border-[var(--color-green)] bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <span className="text-sm font-medium">
                  {f.emoji} {t(f.key, locale)}
                </span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  active ? 'bg-[var(--color-green)] text-white' : 'bg-gray-300 text-white'
                }`}>
                  {active ? t('parental.enabled', locale) : t('parental.blocked', locale)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Max daily time */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-[var(--color-text)] mb-4">{t('parental.max_daily_time', locale)}</h3>
        <div className="flex gap-3 flex-wrap">
          {[15, 30, 45, 60, 90, 120].map((min) => (
            <button
              key={min}
              onClick={() => changeTime(min)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                profile.maxDailyTimeMinutes === min
                  ? 'bg-[var(--color-blue)] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {min} min
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
