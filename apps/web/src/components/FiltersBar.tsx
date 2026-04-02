'use client';

import { SPORTS, sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

interface FiltersBarProps {
  activeSport: string | null;
  onSportChange: (sport: string | null) => void;
  locale: Locale;
}

export function FiltersBar({ activeSport, onSportChange, locale }: FiltersBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Sport filter">
      <button
        role="tab"
        aria-selected={!activeSport}
        onClick={() => onSportChange(null)}
        className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          !activeSport
            ? 'bg-[var(--color-blue)] text-white'
            : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-background)] border border-[var(--color-border)]'
        }`}
      >
        {t('filters.all', locale)}
      </button>
      {SPORTS.map((sport) => (
        <button
          key={sport}
          role="tab"
          aria-selected={sport === activeSport}
          onClick={() => onSportChange(sport === activeSport ? null : sport)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            sport === activeSport
              ? 'bg-[var(--color-blue)] text-white'
              : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-background)] border border-[var(--color-border)]'
          }`}
        >
          {sportToEmoji(sport)} {getSportLabel(sport, locale)}
        </button>
      ))}
    </div>
  );
}
