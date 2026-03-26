'use client';

import type { Locale } from '@sportykids/shared';
import { t } from '@sportykids/shared';

interface StreakCounterProps {
  currentStreak: number;
  longestStreak: number;
  locale: Locale;
}

export function StreakCounter({ currentStreak, longestStreak, locale }: StreakCounterProps) {
  return (
    <div className="flex items-center gap-4 bg-[var(--color-surface)] rounded-xl px-5 py-3 shadow-sm border border-[var(--color-border)]">
      <div className="flex items-center gap-2">
        <span className="text-2xl" role="img" aria-label="fire">
          🔥
        </span>
        <div>
          <p className="text-2xl font-bold text-[var(--color-text)]">{currentStreak}</p>
          <p className="text-xs text-[var(--color-muted)]">{t('streak.current', locale)}</p>
        </div>
      </div>
      <div className="w-px h-10 bg-[var(--color-border)]" />
      <div>
        <p className="text-lg font-semibold text-[var(--color-muted)]">{longestStreak}</p>
        <p className="text-xs text-[var(--color-muted)]">{t('streak.longest', locale)}</p>
      </div>
    </div>
  );
}
