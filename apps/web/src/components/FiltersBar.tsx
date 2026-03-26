'use client';

import { SPORTS, AGE_RANGES, sportToEmoji, t, getSportLabel, getAgeRangeLabel } from '@sportykids/shared';
import type { AgeRange, Locale } from '@sportykids/shared';

interface FiltersBarProps {
  activeSport: string | null;
  activeAge: AgeRange | null;
  onSportChange: (sport: string | null) => void;
  onAgeChange: (age: AgeRange | null) => void;
  locale: Locale;
}

export function FiltersBar({ activeSport, activeAge, onSportChange, onAgeChange, locale }: FiltersBarProps) {
  return (
    <div className="space-y-3">
      {/* Sport filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
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

      {/* Age filter */}
      <div className="flex gap-2">
        <span className="text-sm text-[var(--color-muted)] py-2">{t('filters.age', locale)}</span>
        <button
          onClick={() => onAgeChange(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !activeAge
              ? 'bg-[var(--color-green)] text-white'
              : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-background)] border border-[var(--color-border)]'
          }`}
        >
          {t('filters.all_ages', locale)}
        </button>
        {(Object.keys(AGE_RANGES) as AgeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => onAgeChange(range === activeAge ? null : range)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              range === activeAge
                ? 'bg-[var(--color-green)] text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-background)] border border-[var(--color-border)]'
            }`}
          >
            {getAgeRangeLabel(range, locale)}
          </button>
        ))}
      </div>
    </div>
  );
}
