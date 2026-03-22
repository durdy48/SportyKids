'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AGE_RANGES, t } from '@sportykids/shared';
import type { NewsItem, AgeRange } from '@sportykids/shared';
import { fetchNews } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { NewsCard } from '@/components/NewsCard';
import { FiltersBar } from '@/components/FiltersBar';

export function HomeFeedClient() {
  const { user, loading: userLoading, locale } = useUser();
  const router = useRouter();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [activeAge, setActiveAge] = useState<AgeRange | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect to onboarding if no user
  useEffect(() => {
    if (!userLoading && !user) {
      router.replace('/onboarding');
    }
  }, [userLoading, user, router]);

  const loadNews = useCallback(async (pg: number, accumulate: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      const ageRange = activeAge ? AGE_RANGES[activeAge] : null;
      const result = await fetchNews({
        sport: activeSport ?? undefined,
        age: ageRange ? ageRange.min : (user ? user.age : undefined),
        page: pg,
        limit: 20,
      });

      setNews((prev) => accumulate ? [...prev, ...result.news] : result.news);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loading_news', locale));
    } finally {
      setLoading(false);
    }
  }, [activeSport, activeAge, user, locale]);

  useEffect(() => {
    if (!userLoading && user) {
      setPage(1);
      loadNews(1);
    }
  }, [loadNews, userLoading, user]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadNews(next, true);
  };

  if (userLoading || !user) return null;

  return (
    <div className="space-y-6">
      <FiltersBar
        activeSport={activeSport}
        activeAge={activeAge}
        onSportChange={setActiveSport}
        onAgeChange={setActiveAge}
        locale={locale}
      />

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {!loading && news.length === 0 && !error && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">🏟️</p>
          <p className="text-lg font-medium">{t('home.no_news', locale)}</p>
          <p className="text-sm">{t('home.no_news_hint', locale)}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {news.map((item) => (
          <NewsCard key={item.id} news={item} locale={locale} />
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-[var(--color-blue)] border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && page < totalPages && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            className="px-6 py-3 bg-[var(--color-blue)] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {t('buttons.load_more', locale)}
          </button>
        </div>
      )}
    </div>
  );
}
