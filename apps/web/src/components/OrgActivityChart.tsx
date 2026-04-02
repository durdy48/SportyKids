'use client';

import { t } from '@sportykids/shared';

interface DailyData {
  date: string;
  activeMembers: number;
  newsRead: number;
  reelsWatched: number;
  quizAnswered: number;
}

interface Props {
  daily: DailyData[];
  locale: string;
  colors: Record<string, string>;
}

export function OrgActivityChart({ daily, locale, colors }: Props) {
  const maxValue = Math.max(...daily.map((d) => d.newsRead + d.reelsWatched + d.quizAnswered), 1);

  return (
    <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}>
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {daily.map((d) => {
          const total = d.newsRead + d.reelsWatched + d.quizAnswered;
          const height = Math.max((total / maxValue) * 100, 4);
          const dateLabel = d.date.slice(5); // MM-DD

          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${height}%`,
                  backgroundColor: colors.blue,
                  minHeight: 4,
                }}
                title={`${dateLabel}: ${total}`}
                role="img"
                aria-label={t('org.chart_bar_label', locale, { date: dateLabel, count: String(total) })}
              />
              <span className="text-[10px]" style={{ color: colors.muted }}>
                {dateLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
