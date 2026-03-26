'use client';

import type { TeamStats } from '@sportykids/shared';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

interface TeamStatsCardProps {
  stats: TeamStats;
  locale: Locale;
}

function resultColor(result: 'W' | 'D' | 'L'): string {
  switch (result) {
    case 'W': return 'bg-[var(--color-green)]';
    case 'D': return 'bg-[var(--color-yellow)]';
    case 'L': return 'bg-red-500';
  }
}

function resultLabel(result: 'W' | 'D' | 'L', locale: Locale): string {
  switch (result) {
    case 'W': return t('team.win', locale);
    case 'D': return t('team.draw', locale);
    case 'L': return t('team.loss', locale);
  }
}

export function TeamStatsCard({ stats, locale }: TeamStatsCardProps) {
  const lastFive = stats.recentResults.slice(0, 5);

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 space-y-5">
      {/* League position */}
      {stats.leaguePosition != null && (
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-blue)]/10">
            <span className="text-3xl font-bold text-[var(--color-blue)] font-[family-name:var(--font-poppins)]">
              {stats.leaguePosition}
            </span>
          </div>
          <div>
            <p className="text-sm text-[var(--color-muted)]">{t('team.league_position', locale)}</p>
            <p className="font-semibold text-[var(--color-text)] font-[family-name:var(--font-poppins)]">
              {stats.teamName}
            </p>
          </div>
        </div>
      )}

      {/* Recent results */}
      {lastFive.length > 0 && (
        <div>
          <p className="text-sm font-medium text-[var(--color-muted)] mb-3">{t('team.recent_results', locale)}</p>
          <div className="flex gap-2">
            {lastFive.map((r, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div className={`w-8 h-8 rounded-full ${resultColor(r.result)} flex items-center justify-center`}>
                  <span className="text-xs font-bold text-white">{resultLabel(r.result, locale)}</span>
                </div>
                <span className="text-[10px] text-[var(--color-muted)] text-center leading-tight truncate w-full">
                  {r.opponent}
                </span>
                <span className="text-[10px] text-[var(--color-muted)]">{r.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top scorer */}
      {stats.topScorer && (
        <div className="flex items-center gap-3 bg-[var(--color-yellow)]/10 rounded-xl px-4 py-3">
          <span className="text-xl">{'\u26BD'}</span>
          <div>
            <p className="text-xs text-[var(--color-muted)]">{t('team.top_scorer', locale)}</p>
            <p className="text-sm font-semibold text-[var(--color-text)]">{stats.topScorer}</p>
          </div>
        </div>
      )}

      {/* Next match */}
      {stats.nextMatch && (
        <div className="flex items-center gap-3 bg-[var(--color-blue)]/5 rounded-xl px-4 py-3">
          <span className="text-xl">{'\u{1F4C5}'}</span>
          <div>
            <p className="text-xs text-[var(--color-muted)]">{t('team.next_match', locale)}</p>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              vs {stats.nextMatch.opponent}
            </p>
            <p className="text-xs text-[var(--color-muted)]">
              {stats.nextMatch.competition} &middot; {new Date(stats.nextMatch.date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
