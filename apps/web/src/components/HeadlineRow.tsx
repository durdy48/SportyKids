'use client';

import { useState } from 'react';
import type { NewsItem } from '@sportykids/shared';
import { sportToColor, truncateText, formatDate, t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { HeartIcon } from './HeartIcon';
import { isFavorite, toggleFavorite } from '@/lib/favorites';

interface HeadlineRowProps {
  news: NewsItem;
  locale: Locale;
  isTrending?: boolean;
}

export function HeadlineRow({ news, locale, isTrending = false }: HeadlineRowProps) {
  const dotColor = sportToColor(news.sport);
  const [liked, setLiked] = useState(() => isFavorite(news.id));

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleFavorite(news.id);
    setLiked(result);
  };

  return (
    <a
      href={news.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface)] rounded-xl hover:bg-[var(--color-background)] transition-colors border border-[var(--color-border)] group"
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

      {/* Trending badge */}
      {isTrending && (
        <span className="shrink-0 text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
          {'\uD83D\uDD25'}
        </span>
      )}

      {/* Source + time */}
      <div className="shrink-0 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <span className="font-medium text-[var(--color-muted)]">{news.source}</span>
        <span>{formatDate(news.publishedAt, locale)}</span>
      </div>

      {/* Heart */}
      <button
        type="button"
        onClick={handleToggleFavorite}
        aria-label={liked ? t('favorites.unsave', locale) : t('favorites.save', locale)}
        className="shrink-0 w-6 h-6 flex items-center justify-center hover:scale-125 active:scale-95 transition-transform"
      >
        <HeartIcon filled={liked} size={14} />
      </button>
    </a>
  );
}
