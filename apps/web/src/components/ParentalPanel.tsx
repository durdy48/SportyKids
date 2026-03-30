'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ParentalProfile } from '@sportykids/shared';
import { SPORTS, sportToEmoji, t, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
import type { AgeRange } from '@sportykids/shared';
import { updateParentalProfile, fetchActivity, fetchActivityDetail, verifyPin, setupParentalPin, updateUser, getDigestPreferences, updateDigestPreferences, previewDigest, downloadDigestPdf, sendTestDigestEmail, deleteUserData } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import Link from 'next/link';
import { FeedPreviewModal } from './FeedPreviewModal';
import { ContentReportList } from './ContentReportList';

const FORMATS = [
  { id: 'news', key: 'nav.news', emoji: '\u{1F4F0}' },
  { id: 'reels', key: 'nav.reels', emoji: '\u{1F3AC}' },
  { id: 'quiz', key: 'nav.quiz', emoji: '\u{1F9E0}' },
] as const;

interface DigestPreview {
  userName: string;
  period: { from: string; to: string };
  totalMinutes: number;
  dailyAverage: number;
  byType: { news_viewed: number; reels_viewed: number; quizzes_played: number };
  topSports: Array<{ sport: string; count: number }>;
  quizPerformance: { total: number; correctPercent: number; perfectCount: number };
  moderationBlocked: number;
  streak: { current: number; longest: number };
  weekRange?: string;
  summary?: string;
  highlights?: string[];
}

type Tab = 'profile' | 'content' | 'restrictions' | 'activity' | 'pin' | 'digest';

const TABS: Tab[] = ['profile', 'content', 'restrictions', 'activity', 'pin', 'digest'];

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

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // PIN change state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Digest state
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestEmail, setDigestEmail] = useState('');
  const [digestDay, setDigestDay] = useState(1);
  const [digestLoaded, setDigestLoaded] = useState(false);
  const [digestPreview, setDigestPreview] = useState<DigestPreview | null>(null);
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestSavedToast, setDigestSavedToast] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailMessage, setTestEmailMessage] = useState('');
  const [testEmailSuccess, setTestEmailSuccess] = useState(false);

  // Content state
  const [allowedSports, setAllowedSports] = useState<string[]>(
    user?.favoriteSports ?? []
  );

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line no-console
      fetchActivity(user.id).then(setActivity).catch(console.error);
    }
  }, [user]);

  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  useEffect(() => {
    if (user && activeTab === 'activity') {
      fetchActivityDetail(user.id, week.from, week.to)
        .then(setActivityDetail)
        // eslint-disable-next-line no-console
        .catch(console.error);
    }
  }, [user, activeTab, week]);

  // Load digest preferences when tab activates
  useEffect(() => {
    if (user && activeTab === 'digest' && !digestLoaded) {
      getDigestPreferences(user.id)
        .then((prefs) => {
          setDigestEnabled(prefs.digestEnabled ?? false);
          setDigestEmail(prefs.digestEmail ?? '');
          setDigestDay(prefs.digestDay ?? 1);
          setDigestLoaded(true);
        })
        .catch(() => setDigestLoaded(true));
    }
  }, [user, activeTab, digestLoaded]);

  const handleDigestChange = async (data: { digestEnabled?: boolean; digestEmail?: string | null; digestDay?: number }) => {
    if (!user) return;
    setDigestSaving(true);
    try {
      await updateDigestPreferences(user.id, data);
      setDigestSavedToast(true);
      setTimeout(() => setDigestSavedToast(false), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setDigestSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!user) return;
    setTestEmailSending(true);
    setTestEmailMessage('');
    setTestEmailSuccess(false);
    try {
      const result = await sendTestDigestEmail(user.id);
      setTestEmailMessage(t('digest.test_sent', locale, { email: result.sentTo }));
      setTestEmailSuccess(true);
    } catch {
      setTestEmailMessage(t('digest.test_error', locale));
      setTestEmailSuccess(false);
    } finally {
      setTestEmailSending(false);
    }
  };

  const handleDigestPreview = async () => {
    if (!user) return;
    try {
      const data = await previewDigest(user.id);
      setDigestPreview(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const handleDigestDownload = async () => {
    if (!user) return;
    try {
      const blob = await downloadDigestPdf(user.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `digest-${user.name}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const saveProfile = async (data: Partial<ParentalProfile>) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateParentalProfile(user.id, data);
      setProfile(updated);
      setParentalProfile(updated);
    } catch (err) {
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
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
        if (check.status === 423) {
          setPinError(check.error ?? t('parental.pin_locked', locale, { minutes: '15' }));
        } else if (check.status === 429) {
          setPinError(t('errors.rate_limited', locale));
        } else {
          setPinError(check.error ?? t('errors.incorrect_pin', locale));
        }
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
          <p className="text-[var(--color-muted)] text-sm mt-1">
            {t('parental.manage_content', locale, { name: user?.name ?? '' })}
          </p>
        </div>
        {saving && (
          <span className="text-xs text-[var(--color-muted)]">{t('buttons.saving', locale)}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-background)] rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'bg-[var(--color-surface)] text-[var(--color-blue)] shadow-sm'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {t(`parental.tab_${tab}`, locale)}
          </button>
        ))}
      </div>

      {/* Tab: Profile */}
      {activeTab === 'profile' && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] space-y-5">
          <div>
            <label className="text-sm font-medium text-[var(--color-text)] block mb-2">
              {t('onboarding.step1_title', locale).replace(/[!?]/g, '')}
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
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
                      : 'bg-[var(--color-background)] text-[var(--color-muted)]'
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
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[var(--color-blue)]">{activity.news_viewed}</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">{t('parental.news_read', locale)}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-purple-600">{activity.reels_viewed}</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">{t('parental.reels_viewed', locale)}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[var(--color-green)]">{activity.quizzes_played}</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">{t('parental.quizzes_played', locale)}</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[var(--color-yellow)]">{activity.totalPoints}</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">{t('parental.total_points', locale)}</p>
              </div>
            </div>
          )}

          {/* Feed preview button */}
          <button
            onClick={() => setShowPreview(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border-2 border-[var(--color-blue)] text-[var(--color-blue)] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            {'\u{1F441}'} {t('preview.button', locale, { name: user?.name ?? '' })}
          </button>
        </div>
      )}

      {/* Feed preview modal */}
      {showPreview && user && (
        <FeedPreviewModal
          userId={user.id}
          userName={user.name}
          locale={locale}
          restrictions={{
            blockedFormats: ['news', 'reels', 'quiz'].filter((f) => !profile.allowedFormats.includes(f as 'news' | 'reels' | 'quiz')),
            blockedSports: [], // Sports are additive, not blocked
            hasTimeLimit: !!profile.maxDailyTimeMinutes && profile.maxDailyTimeMinutes > 0,
            hasScheduleLock: (profile.allowedHoursStart ?? 0) !== 0 || (profile.allowedHoursEnd ?? 24) !== 24,
          }}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Tab: Content */}
      {activeTab === 'content' && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] space-y-5">
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
                    : 'bg-[var(--color-background)] text-[var(--color-muted)]'
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
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)]">
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
                        ? 'border-[var(--color-green)] bg-green-50 dark:bg-green-900/20'
                        : 'border-[var(--color-border)] bg-[var(--color-background)]'
                    }`}
                  >
                    <span className="text-sm font-medium">
                      {f.emoji} {t(f.key, locale)}
                    </span>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        active
                          ? 'bg-[var(--color-green)] text-white'
                          : 'bg-gray-300 dark:bg-gray-600 text-white'
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
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)]">
            <h3 className="font-semibold text-[var(--color-text)] mb-4">
              {t('restrictions.time_limits', locale)}
            </h3>

            {/* Total daily limit */}
            <p className="text-sm text-[var(--color-muted)] mb-3">
              {t('restrictions.total_limit', locale)}
            </p>
            <div className="flex gap-3 flex-wrap">
              {[15, 30, 60, 90, 120].map((min) => (
                <button
                  key={min}
                  onClick={() => changeTime(min)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    profile.maxDailyTimeMinutes === min
                      ? 'bg-[var(--color-blue)] text-white'
                      : 'bg-[var(--color-background)] text-[var(--color-muted)] hover:bg-[var(--color-border)]'
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
                    : 'bg-[var(--color-background)] text-[var(--color-muted)] hover:bg-[var(--color-border)]'
                }`}
              >
                {t('onboarding.no_limit', locale)}
              </button>
            </div>

            {/* Per content type limits */}
            <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-muted)] mb-4">
                {t('restrictions.per_type', locale)}
              </p>
              <div className="space-y-4">
                {([
                  { field: 'maxNewsMinutes' as const, label: 'restrictions.news_limit', emoji: '\u{1F4F0}' },
                  { field: 'maxReelsMinutes' as const, label: 'restrictions.reels_limit', emoji: '\u{1F3AC}' },
                  { field: 'maxQuizMinutes' as const, label: 'restrictions.quiz_limit', emoji: '\u{1F9E0}' },
                ] as const).map(({ field, label, emoji }) => {
                  const value = profile[field] ?? 0;
                  return (
                    <div key={field}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--color-text)]">
                          {emoji} {t(label, locale)}
                        </span>
                        <span className="text-sm text-[var(--color-muted)] min-w-[120px] text-right">
                          {value === 0
                            ? t('restrictions.no_specific_limit', locale)
                            : t('restrictions.minutes', locale, { n: String(value) })}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={120}
                        step={5}
                        value={value}
                        onChange={(e) => {
                          const num = parseInt(e.target.value, 10);
                          saveProfile({ [field]: num === 0 ? null : num });
                        }}
                        className="w-full h-2 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-[var(--color-blue)]"
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-3">
                {t('restrictions.per_type_tip', locale)}
              </p>
            </div>

            {/* Schedule lock (B-PT4) */}
            <div className="border-t border-[var(--color-border)] pt-4 mt-4">
              <h4 className="font-[family-name:var(--font-poppins)] font-semibold text-[var(--color-text)] mb-3">
                {t('schedule.title', locale)}
              </h4>

              {/* Toggle */}
              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={(profile.allowedHoursStart ?? 0) !== 0 || (profile.allowedHoursEnd ?? 24) !== 24}
                  onChange={(e) => {
                    if (e.target.checked) {
                      saveProfile({ allowedHoursStart: 7, allowedHoursEnd: 21 } as Partial<ParentalProfile>);
                    } else {
                      saveProfile({ allowedHoursStart: 0, allowedHoursEnd: 24 } as Partial<ParentalProfile>);
                    }
                  }}
                  className="w-5 h-5 rounded accent-[var(--color-blue)]"
                />
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {t('schedule.enable', locale)}
                </span>
              </label>

              {((profile.allowedHoursStart ?? 0) !== 0 || (profile.allowedHoursEnd ?? 24) !== 24) && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <label className="text-sm text-[var(--color-muted)]">
                      {t('schedule.start_time', locale)}
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={profile.allowedHoursStart ?? 7}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 0 && val <= 23) {
                            saveProfile({ allowedHoursStart: val } as Partial<ParentalProfile>);
                          }
                        }}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
                      />
                    </label>
                    <label className="text-sm text-[var(--color-muted)]">
                      {t('schedule.end_time', locale)}
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={profile.allowedHoursEnd ?? 21}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 0 && val <= 24) {
                            saveProfile({ allowedHoursEnd: val } as Partial<ParentalProfile>);
                          }
                        }}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
                      />
                    </label>
                  </div>

                  {/* Timezone */}
                  <label className="text-sm text-[var(--color-muted)] block mb-4">
                    {t('schedule.timezone', locale)}
                    <select
                      value={profile.timezone ?? 'Europe/Madrid'}
                      onChange={(e) => saveProfile({ timezone: e.target.value } as Partial<ParentalProfile>)}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
                    >
                      {['Europe/Madrid', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Mexico_City', 'Asia/Tokyo'].map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </label>

                  {/* Dynamic description */}
                  <p className="text-sm text-[var(--color-muted)] bg-[var(--color-background)] rounded-lg p-3">
                    {t('schedule.description', locale, {
                      start: String(profile.allowedHoursStart ?? 7),
                      end: String(profile.allowedHoursEnd ?? 21),
                      timezone: profile.timezone ?? 'Europe/Madrid',
                    })}
                  </p>
                </>
              )}

              {(profile.allowedHoursStart ?? 0) === 0 && (profile.allowedHoursEnd ?? 24) === 24 && (
                <p className="text-sm text-[var(--color-muted)]">
                  {t('schedule.all_day', locale)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Activity */}
      {activeTab === 'activity' && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] space-y-5">
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
              className="text-sm text-[var(--color-blue)] hover:underline disabled:text-[var(--color-border)] disabled:no-underline"
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
                      <span className="text-[10px] text-[var(--color-muted)]">{minutes > 0 ? `${minutes}m` : ''}</span>
                      <div
                        className="w-full rounded-t-lg bg-[var(--color-blue)] transition-all"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[10px] text-[var(--color-muted)] font-medium">{DAY_LABELS[i]}</span>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Average + most viewed */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-[var(--color-blue)]">{averageDaily}m</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">{t('parental.average_daily', locale)}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">
                {activityDetail?.mostViewed
                  ? getSportLabel(activityDetail.mostViewed, locale)
                  : '-'}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">{t('parental.most_viewed', locale)}</p>
            </div>
          </div>

          {/* Breakdown by format */}
          {activityDetail && (
            <div>
              <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">
                {t('parental.weekly_activity', locale)}
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-[var(--color-blue)]">
                    {activityDetail.days.reduce((s, d) => s + d.news_viewed, 0)}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">{t('parental.news_read', locale)}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-purple-600">
                    {activityDetail.days.reduce((s, d) => s + d.reels_viewed, 0)}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">{t('parental.reels_viewed', locale)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-[var(--color-green)]">
                    {activityDetail.days.reduce((s, d) => s + d.quizzes_played, 0)}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">{t('parental.quizzes_played', locale)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Content Reports */}
          {user && (
            <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
              <ContentReportList userId={user.id} locale={locale} />
            </div>
          )}
        </div>
      )}

      {/* Tab: Digest */}
      {activeTab === 'digest' && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] space-y-5">
          <h3 className="font-semibold text-[var(--color-text)]">
            {t('digest.title', locale)}
          </h3>

          {/* Enable toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={digestEnabled}
              onChange={(e) => {
                setDigestEnabled(e.target.checked);
                handleDigestChange({ digestEnabled: e.target.checked });
              }}
              className="w-5 h-5 rounded accent-[var(--color-blue)]"
            />
            <span className="text-sm font-medium text-[var(--color-text)]">
              {t('digest.enable', locale)}
            </span>
            {digestSaving && <span className="text-xs text-[var(--color-muted)]">{t('buttons.saving', locale)}</span>}
            {digestSavedToast && <span className="text-xs text-[var(--color-green)] font-medium">{t('digest.saved', locale)}</span>}
          </label>

          {digestEnabled && (
            <div className="space-y-5">
              {/* Email input */}
              <div>
                <label className="text-sm text-[var(--color-muted)] block mb-1">
                  {t('digest.email_label', locale)}
                </label>
                <input
                  type="email"
                  value={digestEmail}
                  onChange={(e) => setDigestEmail(e.target.value)}
                  onBlur={() => handleDigestChange({ digestEmail: digestEmail.trim() || null })}
                  placeholder={t('digest.email_placeholder', locale)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
                />
                {!digestEmail.trim() && (
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    {t('digest.no_email_note', locale)}
                  </p>
                )}
                {digestEmail.trim() && (
                  <div className="mt-2">
                    <button
                      onClick={handleSendTestEmail}
                      disabled={testEmailSending}
                      className="text-xs font-medium text-[var(--color-blue)] hover:underline disabled:opacity-50"
                    >
                      {testEmailSending ? t('buttons.loading', locale) : t('digest.send_test', locale)}
                    </button>
                    {testEmailMessage && (
                      <p className={`text-xs mt-1 ${testEmailSuccess ? 'text-[var(--color-green)]' : 'text-red-500'}`}>
                        {testEmailMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Day selector */}
              <div>
                <label className="text-sm text-[var(--color-muted)] block mb-2">
                  {t('digest.send_on', locale)}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <button
                      key={day}
                      onClick={() => {
                        setDigestDay(day);
                        handleDigestChange({ digestDay: day });
                      }}
                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-medium transition-colors ${
                        digestDay === day
                          ? 'bg-[var(--color-blue)] text-white'
                          : 'bg-[var(--color-background)] text-[var(--color-muted)] hover:bg-[var(--color-border)]'
                      }`}
                    >
                      {t(`digest.days.${day}`, locale)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleDigestPreview}
                  className="flex-1 py-3 rounded-xl text-sm font-medium border-2 border-[var(--color-blue)] text-[var(--color-blue)] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {t('digest.preview', locale)}
                </button>
                <button
                  onClick={handleDigestDownload}
                  className="flex-1 py-3 rounded-xl text-sm font-medium bg-[var(--color-blue)] text-white hover:bg-blue-700 transition-colors"
                >
                  {t('digest.download_pdf', locale)}
                </button>
              </div>

              {/* Preview section */}
              {digestPreview && (
                <div className="bg-[var(--color-background)] rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">
                    {t('digest.title', locale)} — {digestPreview.weekRange ?? ''}
                  </h4>
                  {digestPreview.summary && (
                    <p className="text-sm text-[var(--color-muted)]">{digestPreview.summary}</p>
                  )}
                  {digestPreview.highlights && Array.isArray(digestPreview.highlights) && (
                    <ul className="text-sm text-[var(--color-text)] space-y-1">
                      {digestPreview.highlights.map((h: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-[var(--color-blue)] mt-0.5">&#8226;</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: PIN */}
      {activeTab === 'pin' && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] space-y-5">
          <h3 className="font-semibold text-[var(--color-text)]">
            {t('parental.change_pin', locale)}
          </h3>

          <div className="space-y-4 max-w-xs">
            <div>
              <label className="text-sm text-[var(--color-muted)] block mb-1">
                {t('parental.current_pin', locale)}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] text-center text-xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
                placeholder="----"
              />
            </div>

            <div>
              <label className="text-sm text-[var(--color-muted)] block mb-1">
                {t('parental.new_pin', locale)}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] text-center text-xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
                placeholder="----"
              />
            </div>

            <div>
              <label className="text-sm text-[var(--color-muted)] block mb-1">
                {t('parental.confirm_pin', locale)}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] text-center text-xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)] focus:border-transparent"
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

      {/* Danger Zone — Delete Account */}
      <div className="mt-8 pt-6 border-t border-red-200 dark:border-red-900">
        <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
          {t('delete_account.title', locale)}
        </h3>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          {t('delete_account.description', locale)}
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-6 py-3 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          data-testid="delete-account-btn"
        >
          {t('delete_account.button', locale)}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-[var(--color-text)] mb-3">
              {t('delete_account.confirm_title', locale)}
            </h3>
            <p className="text-sm text-[var(--color-muted)] mb-3">
              {t('delete_account.confirm_body', locale, { name: user?.name ?? '' })}
            </p>
            <ul className="text-sm text-[var(--color-muted)] mb-3 space-y-1 ml-4 list-disc">
              <li>{t('delete_account.confirm_reading', locale)}</li>
              <li>{t('delete_account.confirm_quiz', locale)}</li>
              <li>{t('delete_account.confirm_stickers', locale)}</li>
              <li>{t('delete_account.confirm_streaks', locale)}</li>
              <li>{t('delete_account.confirm_parental', locale)}</li>
              <li>{t('delete_account.confirm_activity', locale)}</li>
            </ul>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-4">
              {t('delete_account.confirm_warning', locale)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl font-medium bg-gray-100 dark:bg-gray-700 text-[var(--color-text)] hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('delete_account.confirm_cancel', locale)}
              </button>
              <button
                onClick={async () => {
                  if (!user) return;
                  setDeleting(true);
                  try {
                    const { getParentalSessionToken } = await import('@/lib/api');
                    const sessionToken = getParentalSessionToken() ?? undefined;
                    await deleteUserData(user.id, sessionToken);
                    // Clear all sportykids-prefixed localStorage keys
                    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('sportykids'));
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                    window.location.href = '/age-gate';
                  } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('Delete failed:', err);
                    setDeleting(false);
                    setShowDeleteConfirm(false);
                    alert(t('delete_account.error', locale));
                  }
                }}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                data-testid="delete-confirm-btn"
              >
                {deleting ? '...' : t('delete_account.confirm_delete', locale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legal Links Footer */}
      <div className="mt-6 pt-4 border-t border-[var(--color-border)] text-center text-sm text-[var(--color-muted)]">
        <Link href="/privacy" className="hover:underline">{t('legal.privacy_policy', locale)}</Link>
        {' · '}
        <Link href="/terms" className="hover:underline">{t('legal.terms_of_service', locale)}</Link>
      </div>
    </div>
  );
}
