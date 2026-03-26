'use client';

import type { Achievement } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { t } from '@sportykids/shared';

interface AchievementBadgeProps {
  achievement: Achievement;
  unlocked: boolean;
  locale: Locale;
}

export function AchievementBadge({ achievement, unlocked, locale }: AchievementBadgeProps) {
  const name = t(achievement.nameKey, locale);
  const description = t(achievement.descriptionKey, locale);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${
        unlocked
          ? 'bg-[var(--color-surface)] border-[var(--color-green)]/30 shadow-sm'
          : 'bg-[var(--color-background)] border-[var(--color-border)] opacity-60'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
          unlocked ? 'bg-[var(--color-green)]/10' : 'bg-[var(--color-border)]'
        }`}
      >
        {unlocked ? achievement.icon : '🔒'}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold truncate ${
            unlocked ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]'
          }`}
        >
          {unlocked ? name : t('collection.locked', locale)}
        </p>
        <p className="text-xs text-[var(--color-muted)] truncate">{unlocked ? description : '???'}</p>
      </div>
      {unlocked && (
        <span className="text-[var(--color-green)] text-sm">&#10003;</span>
      )}
    </div>
  );
}
