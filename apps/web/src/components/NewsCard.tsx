'use client';

import { useState } from 'react';
import type { NewsItem } from '@sportykids/shared';
import { sportToEmoji, formatDate, t, getSportLabel } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';
import { AgeAdaptedSummary } from './AgeAdaptedSummary';

interface NewsCardProps {
  news: NewsItem;
  locale: Locale;
  showExplainButton?: boolean;
}

export function NewsCard({ news, locale, showExplainButton = false }: NewsCardProps) {
  const { user } = useUser();
  const [showSummary, setShowSummary] = useState(showExplainButton);
  const userAge = user?.age ?? 10;
  return (
    <article className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow border border-gray-100">
      {news.imageUrl && (
        <div className="relative h-44 overflow-hidden">
          <img
            src={news.imageUrl}
            alt={news.title}
            className="w-full h-full object-cover"
          />
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-sm font-medium px-2.5 py-1 rounded-full">
            {sportToEmoji(news.sport)} {getSportLabel(news.sport, locale)}
          </span>
        </div>
      )}

      <div className="p-4">
        <h3 className="font-[family-name:var(--font-poppins)] font-semibold text-[var(--color-text)] text-base leading-snug mb-2 line-clamp-2">
          {news.title}
        </h3>

        {news.summary && (
          <p className="text-gray-500 text-sm leading-relaxed mb-3 line-clamp-2">
            {news.summary}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-medium text-gray-500">{news.source}</span>
            <span>·</span>
            <span>{formatDate(news.publishedAt, locale)}</span>
          </div>

          {news.team && (
            <span className="text-xs bg-[var(--color-blue)]/10 text-[var(--color-blue)] font-medium px-2 py-0.5 rounded-full">
              {news.team}
            </span>
          )}
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
            className="text-sm font-medium rounded-xl px-3 py-2 transition-colors border"
            style={{
              backgroundColor: showSummary ? '#FACC15' : 'transparent',
              borderColor: showSummary ? '#FACC15' : '#E5E7EB',
              color: showSummary ? '#1E293B' : '#6B7280',
            }}
          >
            {t('summary.explain_easy', locale)}
          </button>
        </div>

        <AgeAdaptedSummary
          newsId={news.id}
          locale={locale}
          userAge={userAge}
          isOpen={showSummary}
        />
      </div>
    </article>
  );
}
