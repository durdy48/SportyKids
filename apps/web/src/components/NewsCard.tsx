'use client';

import { useState, useEffect } from 'react';
import type { NewsItem } from '@sportykids/shared';
import { sportToEmoji, formatDate, t, getSportLabel } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';
import { fetchRelatedArticles } from '@/lib/api';
import { AgeAdaptedSummary } from './AgeAdaptedSummary';
import { HeartIcon } from './HeartIcon';
import { isFavorite, toggleFavorite } from '@/lib/favorites';
import { ReportButton } from './ReportButton';

interface NewsCardProps {
  news: NewsItem;
  locale: Locale;
  showExplainButton?: boolean;
  isTrending?: boolean;
}

export function NewsCard({ news, locale, showExplainButton = false, isTrending = false }: NewsCardProps) {
  const { user } = useUser();
  const [showSummary, setShowSummary] = useState(showExplainButton);
  const [liked, setLiked] = useState(() => isFavorite(news.id));
  const [animating, setAnimating] = useState(false);
  const [related, setRelated] = useState<NewsItem[]>([]);
  const userAge = user?.age ?? 10;

  // Load related articles when summary is shown
  useEffect(() => {
    if (showSummary && related.length === 0) {
      fetchRelatedArticles(news.id, 3).then((res) => setRelated(res.related)).catch(() => {});
    }
  }, [showSummary, news.id, related.length]);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleFavorite(news.id);
    setLiked(result);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
  };

  return (
    <article className="bg-[var(--color-surface)] rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow border border-[var(--color-border)] relative">
      {news.imageUrl && (
        <div className="relative h-44 overflow-hidden">
          <img
            src={news.imageUrl}
            alt={news.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          <span className="absolute top-3 left-3 bg-[var(--color-surface)]/90 backdrop-blur-sm text-sm font-medium px-2.5 py-1 rounded-full">
            {sportToEmoji(news.sport)} {getSportLabel(news.sport, locale)}
          </span>
          {/* Heart / favorite button */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={liked ? t('favorites.unsave', locale) : t('favorites.save', locale)}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-surface)]/90 backdrop-blur-sm shadow-sm hover:scale-110 active:scale-95 transition-transform"
            style={{ transform: animating ? 'scale(1.3)' : 'scale(1)', transition: 'transform 0.3s ease' }}
          >
            <HeartIcon filled={liked} />
          </button>
        </div>
      )}

      {/* Heart button when there is no image */}
      {!news.imageUrl && (
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-label={liked ? t('favorites.unsave', locale) : t('favorites.save', locale)}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-background)] hover:scale-110 active:scale-95 transition-transform z-10"
          style={{ transform: animating ? 'scale(1.3)' : 'scale(1)', transition: 'transform 0.3s ease' }}
        >
          <HeartIcon filled={liked} />
        </button>
      )}

      <div className="p-4">
        <h3 className="font-[family-name:var(--font-poppins)] font-semibold text-[var(--color-text)] text-base leading-snug mb-2 line-clamp-2">
          {news.title}
        </h3>

        {news.summary && (
          <p className="text-[var(--color-muted)] text-sm leading-relaxed mb-3 line-clamp-2">
            {news.summary}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <span className="font-medium text-[var(--color-muted)]">{news.source}</span>
            <span>·</span>
            <span>{formatDate(news.publishedAt, locale)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isTrending && (
              <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                {'\uD83D\uDD25'} {t('news.trending', locale)}
              </span>
            )}
            {news.team && (
              <span className="text-xs bg-[var(--color-blue)]/10 text-[var(--color-blue)] font-medium px-2 py-0.5 rounded-full">
                {news.team}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <a
            href={news.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm font-medium text-white bg-[var(--color-blue)] hover:bg-blue-700 rounded-xl py-2 transition-colors"
          >
            {t('buttons.read_more', locale)}
          </a>
          <button
            type="button"
            onClick={() => setShowSummary((prev) => !prev)}
            aria-pressed={showSummary}
            aria-label="Explain in simple terms"
            className="text-sm font-medium rounded-xl px-3 py-2 transition-colors border"
            style={{
              backgroundColor: showSummary ? 'var(--color-yellow)' : 'transparent',
              borderColor: showSummary ? 'var(--color-yellow)' : 'var(--color-border)',
              color: showSummary ? '#1E293B' : 'var(--color-muted)',
            }}
          >
            {t('summary.explain_easy', locale)}
          </button>
          <ReportButton contentType="news" contentId={news.id} locale={locale} />
        </div>

        <AgeAdaptedSummary
          newsId={news.id}
          locale={locale}
          userAge={userAge}
          isOpen={showSummary}
        />

        {/* Related articles (B-CP4) */}
        {showSummary && related.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-muted)] mb-2">
              {t('related.title', locale)}
            </p>
            <div className="space-y-2">
              {related.map((item) => (
                <a
                  key={item.id}
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs hover:bg-[var(--color-background)] rounded-lg p-1.5 -mx-1.5 transition-colors"
                >
                  <span>{sportToEmoji(item.sport)}</span>
                  <span className="text-[var(--color-text)] line-clamp-1 flex-1">{item.title}</span>
                  <span className="text-[var(--color-muted)] shrink-0">{item.source}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
