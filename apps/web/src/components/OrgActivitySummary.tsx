'use client';

import { t } from '@sportykids/shared';

interface SummaryData {
  totalMembers: number;
  activeMembers: number;
  totalNewsRead: number;
  totalReelsWatched: number;
  totalQuizAnswered: number;
  averageStreak: number;
  averagePoints: number;
}

interface Props {
  summary: SummaryData;
  locale: string;
  colors: Record<string, string>;
}

export function OrgActivitySummary({ summary, locale, colors }: Props) {
  const cards = [
    {
      label: t('org.dashboard_active', locale),
      value: `${summary.activeMembers}/${summary.totalMembers}`,
      sublabel: t('org.dashboard_members', locale),
    },
    {
      label: t('org.dashboard_articles_read', locale),
      value: String(summary.totalNewsRead),
    },
    {
      label: t('org.dashboard_reels_watched', locale),
      value: String(summary.totalReelsWatched),
    },
    {
      label: t('org.dashboard_quiz_answered', locale),
      value: String(summary.totalQuizAnswered),
    },
    {
      label: t('org.dashboard_avg_streak', locale),
      value: `${summary.averageStreak}`,
      sublabel: t('org.streak_label', locale),
    },
    {
      label: t('org.dashboard_avg_points', locale),
      value: String(summary.averagePoints),
      sublabel: t('org.points_label', locale),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="p-4 rounded-xl"
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
            {card.label}
          </p>
          <p className="text-2xl font-bold" style={{ color: colors.text }}>
            {card.value}
          </p>
          {card.sublabel && (
            <p className="text-xs" style={{ color: colors.muted }}>
              {card.sublabel}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
