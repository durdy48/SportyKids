'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ParentalProfile } from '@sportykids/shared';
import { SPORTS, sportToEmoji, t, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
import type { AgeRange } from '@sportykids/shared';
import { updateParentalProfile, fetchActivity, fetchActivityDetail, verifyPin, setupParentalPin, updateUser } from '@/lib/api';
import { useUser } from '@/lib/user-context';

const FORMATS = [
  { id: 'news', key: 'nav.news', emoji: '\u{1F4F0}' },
  { id: 'reels', key: 'nav.reels', emoji: '\u{1F3AC}' },
  { id: 'quiz', key: 'nav.quiz', emoji: '\u{1F9E0}' },
] as const;

type Tab = 'profile' | 'content' | 'restrictions' | 'activity' | 'pin';

const TABS: Tab[] = ['profile', 'content', 'restrictions', 'activity', 'pin'];

interface ParentalPanelProps {
  profile: ParentalProfile;
}

function getWeekRange(offset: number): { from: string; to: string; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return {
    from: fmt(monday),
    to: fmt(sunday),
    label: `${monday.getDate()}/${monday.getMonth() + 1} - ${sunday.getDate()}/${sunday.getMonth() + 1}`,
  };
}

export function ParentalPanel({ profile: initialProfile }: ParentalPanelProps) {
  const { user, setUser, setParentalProfile, locale } = useUser();
  const [profile, setProfile] = useState(initialProfile);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);

  // Activity state
  const [activity, setActivity] = useState<{
    news_viewed: number;
    reels_viewed: number;
    quizzes_played: number;
    totalPoints: number;
  } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [activityDetail, setActivityDetail] = useState<{
    days: { date: string; news_viewed: number; reels_viewed: number; quizzes_played: number; totalMinutes: number }[];
    mostViewed: string;
  } | null>(null);

  // Profile edit state
  const [editName, setEditName] = useState(user?.name ?? '');

  // PIN change state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [pinError, setPinError] = useState('');

  // Content state
  const [allowedSports, setAllowedSports] = useState<string[]>(
    user?.favoriteSports ?? []
  );

  useEffect(() => {
    if (user) {
      fetchActivity(user.id).then(setActivity).catch(console.error);
    }
  }, [user]);

  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  useEffect(() => {
    if (user && activeTab === 'activity') {
      fetchActivityDetail(user.id, week.from, week.to)
        .then(setActivityDetail)
        .catch(console.error);
    }
  }, [user, activeTab, week]);

  const saveProfile = async (data: Partial<ParentalProfile>) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateParentalProfile(user.id, data);
      setProfile(updated);
      setParentalProfile(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleFormat = (format: string) => {
    const formats = profile.allowedFormats.includes(format as 'news' | 'reels' | 'quiz')
      ? profile.allowedFormats.filter((f) => f !== format)
      : [...profile.allowedFormats, format as 'news' | 'reels' | 'quiz'];
    if (formats.length === 0) return;
    saveProfile({ allowedFormats: formats });
  };

  const changeTime = (minutes: number) => {
    saveProfile({ maxDailyTimeMinutes: minutes });
  };

  const handleSaveName = async () => {
    if (!user || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateUser(user.id, { name: editName.trim() });
      setUser(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleSport = async (sport: string) => {
    if (!user) return;
    const next = allowedSports.includes(sport)
      ? allowedSports.filter((s) => s !== sport)
      : [...allowedSports, sport];
    if (next.length === 0) return;
    setAllowedSports(next);
    setSaving(true);
    try {
      const updated = await updateUser(user.id, { favoriteSports: next });
      setUser(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async () => {
    if (!user) return;
    setPinMessage('');
    setPinError('');

    if (newPin.length !== 4 || newPin !== confirmPin) {
      setPinError(t('errors.pins_mismatch', locale));
      return;
    }

    try {
      const check = await verifyPin(user.id, currentPin);
      if (!check.verified) {
        setPinError(t('errors.incorrect_pin', locale));
        return;
      }
      await setupParentalPin(user.id, newPin);
      setPinMessage(t('parental.pin_changed', locale));
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch {
      setPinError(t('errors.connection_error', locale));
    }
  };

  // Compute max bar height for chart
  const maxMinutes = useMemo(() => {
    if (!activityDetail) return 1;
    return Math.max(1, ...activityDetail.days.map((d) => d.totalMinutes));
  }, [activityDetail]);

  const averageDaily = useMemo(() => {
    if (!activityDetail || activityDetail.days.length === 0) return 0;
    const total = activityDetail.days.reduce((s, d) => s + d.totalMinutes, 0);
    return Math.round(total / activityDetail.days.length);
  }, [activityDetail]);

  const getAgeRange = (age: number): AgeRange => {
    if (age <= 8) return '6-8';
    if (age <= 11) return '9-11';
    return '12-14';
  };

  const DAY_LABELS = [
    t('parental.day_mon', locale),
    t('parental.day_tue', locale),
    t('parental.day_wed', locale),
    t('parental.day_thu', locale),
    t('parental.day_fri', locale),
    t('parental.day_sat', locale),
    t('parental.day_sun', locale),
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
            {'\u{1F512}'} {t('parental.control', locale)}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {t('parental.manage_content', locale, { name: user?.name ?? '' })}
          </p>
        </div>
        {saving && (
          <span className="text-xs text-gray-400">{t('buttons.saving', locale)}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'bg-white text-[var(--color-blue)] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(`parental.tab_${tab}`, locale)}
          </button>
        ))}
      </div>

      {/* Tab: Profile */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          <div>
            <label className="text-sm font-medium text-[var(--color-text)] block mb-2">
              {t('onboarding.step1_title', locale).replace(/[!?]/g, '')}
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
                maxLength={50}
              />
              <button
                onClick={handleSaveName}
                disabled={saving || !editName.trim() || editName.trim() === user?.name}
                className="px-5 py-3 rounded-xl text-sm font-medium bg-[var(--color-blue)] text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('buttons.confirm', locale)}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)] block mb-2">
              {t('onboarding.age_question', locale)}
            </label>
            <div className="flex gap-3">
              {(['6-8', '9-11', '12-14'] as AgeRange[]).map((range) => (
                <div
                  key={range}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium text-center ${
                    user && getAgeRange(user.age) === range
                      ? 'bg-[var(--color-blue)] text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {getAgeRangeLabel(range, locale)}
                </div>
              ))}
            </div>
          </div>

          {/* Activity summary cards */}
          {activity && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[var(--color-blue)]">{activity.news_viewed}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('parental.news_read', locale)}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-purple-600">{activity.reels_viewed}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('parental.reels_viewed', locale)}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[var(--color-green)]">{activity.quizzes_played}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('parental.quizzes_played', locale)}</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[var(--color-yellow)]">{activity.totalPoints}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('parental.total_points', locale)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Content */}
      {activeTab === 'content' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          <h3 className="font-semibold text-[var(--color-text)]">
            {t('onboarding.step2_title', locale)}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {SPORTS.map((sport) => (
              <button
                key={sport}
                onClick={() => toggleSport(sport)}
                className={`py-3 px-4 rounded-xl text-sm font-medium transition-colors ${
                  allowedSports.includes(sport)
                    ? 'bg-[var(--color-green)] text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {sportToEmoji(sport)} {getSportLabel(sport, locale)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Restrictions */}
      {activeTab === 'restrictions' && (
        <div className="space-y-5">
          {/* Allowed formats */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-[var(--color-text)] mb-4">
              {t('parental.allowed_formats', locale)}
            </h3>
            <div className="space-y-3">
              {FORMATS.map((f) => {
                const active = profile.allowedFormats.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFormat(f.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${
                      active
                        ? 'border-[var(--color-green)] bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <span className="text-sm font-medium">
                      {f.emoji} {t(f.key, locale)}
                    </span>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        active
                          ? 'bg-[var(--color-green)] text-white'
                          : 'bg-gray-300 text-white'
                      }`}
                    >
                      {active
                        ? t('parental.enabled', locale)
                        : t('parental.blocked', locale)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Max daily time */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-[var(--color-text)] mb-4">
              {t('parental.max_daily_time', locale)}
            </h3>
            <div className="flex gap-3 flex-wrap">
              {[15, 30, 60, 90, 120].map((min) => (
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
              <button
                onClick={() => changeTime(0)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  !profile.maxDailyTimeMinutes || profile.maxDailyTimeMinutes === 0
                    ? 'bg-[var(--color-blue)] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('onboarding.no_limit', locale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Activity */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="text-sm text-[var(--color-blue)] hover:underline"
            >
              {t('parental.prev_week', locale)}
            </button>
            <span className="text-sm font-medium text-[var(--color-text)]">
              {weekOffset === 0 ? t('parental.this_week', locale) : week.label}
            </span>
            <button
              onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
              disabled={weekOffset >= 0}
              className="text-sm text-[var(--color-blue)] hover:underline disabled:text-gray-300 disabled:no-underline"
            >
              {t('parental.next_week', locale)}
            </button>
          </div>

          {/* CSS-only bar chart */}
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">
              {t('parental.daily_usage', locale)}
            </h4>
            <div className="flex items-end gap-2 h-40">
              {(activityDetail?.days ?? Array.from({ length: 7 }, () => ({ totalMinutes: 0 }))).map(
                (day, i) => {
                  const height =
                    maxMinutes > 0
                      ? Math.max(4, (('totalMinutes' in day ? day.totalMinutes : 0) / maxMinutes) * 100)
                      : 4;
                  const minutes = 'totalMinutes' in day ? day.totalMinutes : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400">{minutes > 0 ? `${minutes}m` : ''}</span>
                      <div
                        className="w-full rounded-t-lg bg-[var(--color-blue)] transition-all"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[10px] text-gray-500 font-medium">{DAY_LABELS[i]}</span>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Average + most viewed */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[var(--color-blue)]">{averageDaily}m</p>
              <p className="text-xs text-gray-500 mt-1">{t('parental.average_daily', locale)}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">
                {activityDetail?.mostViewed
                  ? getSportLabel(activityDetail.mostViewed, locale)
                  : '-'}
              </p>
              <p className="text-xs text-gray-500 mt-1">{t('parental.most_viewed', locale)}</p>
            </div>
          </div>

          {/* Breakdown by format */}
          {activityDetail && (
            <div>
              <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">
                {t('parental.weekly_activity', locale)}
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-[var(--color-blue)]">
                    {activityDetail.days.reduce((s, d) => s + d.news_viewed, 0)}
                  </p>
                  <p className="text-xs text-gray-500">{t('parental.news_read', locale)}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-purple-600">
                    {activityDetail.days.reduce((s, d) => s + d.reels_viewed, 0)}
                  </p>
                  <p className="text-xs text-gray-500">{t('parental.reels_viewed', locale)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-[var(--color-green)]">
                    {activityDetail.days.reduce((s, d) => s + d.quizzes_played, 0)}
                  </p>
                  <p className="text-xs text-gray-500">{t('parental.quizzes_played', locale)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: PIN */}
      {activeTab === 'pin' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          <h3 className="font-semibold text-[var(--color-text)]">
            {t('parental.change_pin', locale)}
          </h3>

          <div className="space-y-4 max-w-xs">
            <div>
              <label className="text-sm text-gray-500 block mb-1">
                {t('parental.current_pin', locale)}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
                placeholder="----"
              />
            </div>

            <div>
              <label className="text-sm text-gray-500 block mb-1">
                {t('parental.new_pin', locale)}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
                placeholder="----"
              />
            </div>

            <div>
              <label className="text-sm text-gray-500 block mb-1">
                {t('parental.confirm_pin', locale)}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
                placeholder="----"
              />
            </div>

            {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
            {pinMessage && <p className="text-[var(--color-green)] text-sm">{pinMessage}</p>}

            <button
              onClick={handleChangePin}
              disabled={currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
              className="w-full py-3 rounded-xl font-medium bg-[var(--color-blue)] text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('parental.change_pin', locale)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
