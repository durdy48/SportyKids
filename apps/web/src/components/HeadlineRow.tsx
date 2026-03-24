'use client';

import type { NewsItem } from '@sportykids/shared';
import { sportToColor, truncateText, formatDate } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

interface HeadlineRowProps {
  news: NewsItem;
  locale: Locale;
}

export function HeadlineRow({ news, locale }: HeadlineRowProps) {
  const dotColor = sportToColor(news.sport);

  return (
    <a
      href={news.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 group"
    >
      {/* Sport color dot */}
      <span
        className="shrink-0 w-3 h-3 rounded-full"
        style={{ backgroundColor: dotColor }}
      />

      {/* Title */}
      <span className="flex-1 font-[family-name:var(--font-poppins)] text-sm font-medium text-[var(--color-text)] leading-snug group-hover:text-[var(--color-blue)] transition-colors">
        {truncateText(news.title, 80)}
      </span>

      {/* Source + time */}
      <div className="shrink-0 flex items-center gap-2 text-xs text-gray-400">
        <span className="font-medium text-gray-500">{news.source}</span>
        <span>{formatDate(news.publishedAt, locale)}</span>
      </div>
    </a>
  );
}
