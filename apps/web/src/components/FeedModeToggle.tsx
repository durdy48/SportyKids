'use client';

import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

export type FeedMode = 'cards' | 'headlines' | 'explain';

interface FeedModeToggleProps {
  mode: FeedMode;
  onChange: (mode: FeedMode) => void;
  locale: Locale;
}

const MODES: { key: FeedMode; icon: string; labelKey: string }[] = [
  { key: 'headlines', icon: '\u{1F4CB}', labelKey: 'feed.mode_headlines' },
  { key: 'cards', icon: '\u{1F0CF}', labelKey: 'feed.mode_cards' },
  { key: 'explain', icon: '\u{1F4A1}', labelKey: 'feed.mode_explain' },
];

export function FeedModeToggle({ mode, onChange, locale }: FeedModeToggleProps) {
  return (
    <div className="inline-flex items-center bg-[var(--color-background)] rounded-full p-1 gap-1">
      {MODES.map(({ key, icon, labelKey }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            mode === key
              ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <span>{icon}</span>
          <span>{t(labelKey, locale)}</span>
        </button>
      ))}
    </div>
  );
}
