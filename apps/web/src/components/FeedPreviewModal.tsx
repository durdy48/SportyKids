'use client';

import { useState, useEffect } from 'react';
import type { NewsItem, Reel, Locale } from '@sportykids/shared';
import { t } from '@sportykids/shared';
import { fetchFeedPreview } from '@/lib/api';
import { NewsCard } from './NewsCard';
import { ReelCard } from './ReelCard';

interface FeedPreviewModalProps {
  userId: string;
  userName: string;
  locale: Locale;
  onClose: () => void;
}

export function FeedPreviewModal({ userId, userName, locale, onClose }: FeedPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [quizAvailable, setQuizAvailable] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    fetchFeedPreview(userId)
      .then((data) => {
        setNews(data.news);
        setReels(data.reels);
        setQuizAvailable(data.quizAvailable);
      })
      .catch(() => setError(t('errors.connection_error', locale)))
      .finally(() => setLoading(false));
  }, [userId, locale]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const hasContent = news.length > 0 || reels.length > 0;

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center bg-black/50 overflow-y-auto"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-4xl mx-auto my-8 bg-[var(--color-surface)] rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 py-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-poppins)] text-xl font-bold text-[var(--color-text)]">
                {t('preview.title', locale, { name: userName })}
              </h2>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                {t('preview.description', locale)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--color-background)] hover:bg-[var(--color-border)] transition-colors text-[var(--color-muted)] hover:text-[var(--color-text)] text-lg font-bold"
              aria-label={t('preview.close', locale)}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-[var(--color-blue)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-center text-red-500 py-8">{error}</p>
          )}

          {!loading && !error && !hasContent && (
            <p className="text-center text-[var(--color-muted)] py-16">
              {t('preview.no_content', locale)}
            </p>
          )}

          {!loading && !error && hasContent && (
            <>
              {/* Quiz status */}
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
                    quizAvailable
                      ? 'bg-green-100 text-green-700'
                      : 'bg-[var(--color-background)] text-[var(--color-muted)]'
                  }`}
                >
                  {quizAvailable ? '\u{1F9E0}' : '\u{1F6AB}'}{' '}
                  {quizAvailable
                    ? t('preview.quiz_available', locale)
                    : t('preview.quiz_blocked', locale)}
                </span>
              </div>

              {/* News section */}
              {news.length > 0 && (
                <div>
                  <h3 className="font-[family-name:var(--font-poppins)] font-semibold text-[var(--color-text)] mb-3">
                    {'\u{1F4F0}'} {t('preview.news_section', locale)}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {news.map((item) => (
                      <NewsCard key={item.id} news={item} locale={locale} />
                    ))}
                  </div>
                </div>
              )}

              {/* Reels section */}
              {reels.length > 0 && (
                <div>
                  <h3 className="font-[family-name:var(--font-poppins)] font-semibold text-[var(--color-text)] mb-3">
                    {'\u{1F3AC}'} {t('preview.reels_section', locale)}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reels.map((reel) => (
                      <ReelCard key={reel.id} reel={reel} locale={locale} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
