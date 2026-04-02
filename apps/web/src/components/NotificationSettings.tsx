'use client';

import { useState, useEffect } from 'react';
import { t } from '@sportykids/shared';
import type { Locale, PushPreferences, LiveScorePreferences } from '@sportykids/shared';
import { subscribeNotifications, getNotifications, updateLiveScorePreferences } from '@/lib/api';

interface NotificationSettingsProps {
  userId: string;
  locale: Locale;
  hasFavoriteTeam?: boolean;
}

const DEFAULT_PREFERENCES: PushPreferences = {
  sports: true,
  dailyQuiz: true,
  teamUpdates: true,
};

const DEFAULT_LIVE_PREFS: LiveScorePreferences = {
  enabled: false,
  goals: true,
  matchStart: true,
  matchEnd: true,
  halfTime: true,
  redCards: true,
};

export function NotificationSettings({ userId, locale, hasFavoriteTeam }: NotificationSettingsProps) {
  const [enabled, setEnabled] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferences>(DEFAULT_PREFERENCES);
  const [livePrefs, setLivePrefs] = useState<LiveScorePreferences>(DEFAULT_LIVE_PREFS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getNotifications(userId)
      .then((data) => {
        setEnabled(data.enabled);
        setPreferences(data.preferences);
        if (data.preferences.liveScores) {
          setLivePrefs(data.preferences.liveScores);
        }
      })
      .catch(() => {
        // Endpoint may not exist yet — use defaults
      });
  }, [userId]);

  const save = async (newEnabled: boolean, newPrefs: PushPreferences) => {
    setSaving(true);
    setSaved(false);
    try {
      await subscribeNotifications(userId, { enabled: newEnabled, preferences: newPrefs });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silently fail in MVP
    } finally {
      setSaving(false);
    }
  };

  const saveLivePrefs = async (newLivePrefs: LiveScorePreferences) => {
    setSaving(true);
    setSaved(false);
    try {
      await updateLiveScorePreferences(userId, newLivePrefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    save(newEnabled, preferences);
  };

  const handleTogglePref = (key: 'dailyQuiz' | 'teamUpdates') => {
    const newPrefs = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPrefs);
    save(enabled, newPrefs);
  };

  const handleToggleLivePref = (key: keyof LiveScorePreferences) => {
    const newLivePrefs = { ...livePrefs, [key]: !livePrefs[key] };
    setLivePrefs(newLivePrefs);
    saveLivePrefs(newLivePrefs);
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 space-y-5">
      <h3 className="font-[family-name:var(--font-poppins)] text-lg font-semibold text-[var(--color-text)]">
        {t('notifications.title', locale)}
      </h3>

      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text)]">
          {t('notifications.enable', locale)}
        </span>
        <button
          onClick={handleToggleEnabled}
          role="switch"
          aria-checked={enabled}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            enabled ? 'bg-[var(--color-blue)]' : 'bg-[var(--color-border)]'
          }`}
          aria-label={t('notifications.enable', locale)}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-5.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Preference checkboxes */}
      <div className={`space-y-3 transition-opacity ${enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        {/* Sports updates */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.sports}
            onChange={() => {
              const newPrefs = {
                ...preferences,
                sports: !preferences.sports,
              };
              setPreferences(newPrefs);
              save(enabled, newPrefs);
            }}
            className="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-blue)] focus:ring-[var(--color-blue)]"
          />
          <span className="text-sm text-[var(--color-text)]">{t('notifications.sports', locale)}</span>
        </label>

        {/* Daily quiz */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.dailyQuiz}
            onChange={() => handleTogglePref('dailyQuiz')}
            className="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-blue)] focus:ring-[var(--color-blue)]"
          />
          <span className="text-sm text-[var(--color-text)]">{t('notifications.daily_quiz', locale)}</span>
        </label>

        {/* Team updates */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.teamUpdates}
            onChange={() => handleTogglePref('teamUpdates')}
            className="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-blue)] focus:ring-[var(--color-blue)]"
          />
          <span className="text-sm text-[var(--color-text)]">{t('notifications.team_updates', locale)}</span>
        </label>

        {/* Live Score Notifications — only visible if user has a favorite team */}
        {hasFavoriteTeam && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-3">
            <h4 className="text-sm font-semibold text-[var(--color-text)]">
              {t('live_notifications.title', locale)}
            </h4>
            <p className="text-xs text-[var(--color-muted)]">
              {t('live_notifications.description', locale)}
            </p>

            {/* Live scores master toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text)]">
                {t('live_notifications.enable', locale)}
              </span>
              <button
                onClick={() => handleToggleLivePref('enabled')}
                role="switch"
                aria-checked={livePrefs.enabled}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  livePrefs.enabled ? 'bg-[var(--color-green)]' : 'bg-[var(--color-border)]'
                }`}
                aria-label={t('live_notifications.enable', locale)}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    livePrefs.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Per-event checkboxes */}
            <div className={`space-y-2 transition-opacity ${livePrefs.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {(['goals', 'matchStart', 'halfTime', 'matchEnd', 'redCards'] as const).map((key) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={livePrefs[key]}
                    onChange={() => handleToggleLivePref(key)}
                    className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-green)] focus:ring-[var(--color-green)]"
                  />
                  <span className="text-sm text-[var(--color-text)]">
                    {t(`live_notifications.${key === 'matchStart' ? 'match_start' : key === 'matchEnd' ? 'match_end' : key === 'halfTime' ? 'half_time' : key === 'redCards' ? 'red_cards' : key}`, locale)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status messages */}
      {saved && (
        <p className="text-sm text-[var(--color-green)] font-medium">
          {t('notifications.saved', locale)}
        </p>
      )}

      {saving && (
        <p className="text-sm text-[var(--color-muted)]">{t('buttons.saving', locale)}</p>
      )}

      {/* Coming soon note */}
      <div className="bg-[var(--color-yellow)]/10 rounded-xl px-4 py-3">
        <p className="text-xs text-[var(--color-muted)]">
          {'\u{1F514}'} {t('notifications.mvp_note', locale)}
        </p>
      </div>
    </div>
  );
}
