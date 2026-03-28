'use client';

import { useState, useEffect } from 'react';
import { t } from '@sportykids/shared';
import type { Locale, PushPreferences } from '@sportykids/shared';
import { subscribeNotifications, getNotifications } from '@/lib/api';

interface NotificationSettingsProps {
  userId: string;
  locale: Locale;
}

const DEFAULT_PREFERENCES: PushPreferences = {
  sports: true,
  dailyQuiz: true,
  teamUpdates: true,
};

export function NotificationSettings({ userId, locale }: NotificationSettingsProps) {
  const [enabled, setEnabled] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferences>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getNotifications(userId)
      .then((data) => {
        setEnabled(data.enabled);
        setPreferences(data.preferences);
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
