'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AGE_RANGES, t, sportToEmoji, getSportLabel } from '@sportykids/shared';
import type { NewsItem, AgeRange } from '@sportykids/shared';
import { fetchNews, fetchTrending, fetchReadingHistory } from '@/lib/api';
import { getFavorites } from '@/lib/favorites';
import { useUser } from '@/lib/user-context';
import { useActivityTracker } from '@/lib/use-activity-tracker';
import { NewsCard } from '@/components/NewsCard';
import { HeadlineRow } from '@/components/HeadlineRow';
import { FiltersBar } from '@/components/FiltersBar';
import { FeedModeToggle, type FeedMode } from '@/components/FeedModeToggle';
import { SearchBar } from '@/components/SearchBar';
import { NewsCardSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/EmptyState';
import { LimitReached } from '@/components/LimitReached';
import { MissionCard } from '@/components/MissionCard';

const FEED_MODE_KEY = 'sportykids_feed_mode';
const MAX_SAVED_STRIP = 5;

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
  const [feedMode, setFeedMode] = useState<FeedMode>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingIds, setTrendingIds] = useState<Set<string>>(new Set());
  const [savedNews, setSavedNews] = useState<NewsItem[]>([]);
  const [allFavoriteIds, setAllFavoriteIds] = useState<string[]>([]);
  const [recentlyRead, setRecentlyRead] = useState<NewsItem[]>([]);
  const [parentalBlock, setParentalBlock] = useState<{ reason: string; allowedHoursStart?: number; allowedHoursEnd?: number } | null>(null);

  useActivityTracker(user?.id, 'news_viewed');

  // Load trending IDs on mount
  useEffect(() => {
    fetchTrending().then((res) => {
      setTrendingIds(new Set(res.trendingIds));
    });
  }, []);

  // Load reading history (B-EN4)
  useEffect(() => {
    if (user?.id) {
      fetchReadingHistory(user.id, 1, 5).then((res) => {
        setRecentlyRead(res.history);
      });
    }
  }, [user?.id]);

  // Load persisted feed mode
  useEffect(() => {
    const saved = localStorage.getItem(FEED_MODE_KEY) as FeedMode | null;
    if (saved === 'cards' || saved === 'headlines' || saved === 'explain') {
      setFeedMode(saved);
    }
  }, []);

  const handleFeedModeChange = (mode: FeedMode) => {
    setFeedMode(mode);
    localStorage.setItem(FEED_MODE_KEY, mode);
  };

  // Redirect to onboarding if no user
  useEffect(() => {
    if (!userLoading && !user) {
      router.replace('/onboarding');
    }
  }, [userLoading, user, router]);

  const loadNews = useCallback(async (pg: number, accumulate: boolean = false, queryOverride?: string) => {
    setLoading(true);
    setError(null);
    setParentalBlock(null);

    const q = queryOverride !== undefined ? queryOverride : searchQuery;

    try {
      const ageRange = activeAge ? AGE_RANGES[activeAge] : null;
      const result = await fetchNews({
        sport: activeSport ?? undefined,
        age: ageRange ? ageRange.min : (user ? user.age : undefined),
        userId: user?.id,
        q: q || undefined,
        page: pg,
        limit: 20,
      });

      setNews((prev) => accumulate ? [...prev, ...result.news] : result.news);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      if (err?.status === 403 && err?.reason) {
        setParentalBlock({ reason: err.reason, allowedHoursStart: err.allowedHoursStart, allowedHoursEnd: err.allowedHoursEnd });
      } else {
        setError(err instanceof Error ? err.message : t('errors.loading_news', locale));
      }
    } finally {
      setLoading(false);
    }
  }, [activeSport, activeAge, user, locale, searchQuery]);

  useEffect(() => {
    if (!userLoading && user) {
      setPage(1);
      loadNews(1);
    }
  }, [loadNews, userLoading, user]);

  // Resolve saved/favorite news items from the loaded news
  useEffect(() => {
    const favIds = getFavorites();
    setAllFavoriteIds(favIds);
    if (favIds.length > 0 && news.length > 0) {
      const favSet = new Set(favIds);
      const matched = news.filter((n) => favSet.has(n.id));
      // Sort by favorite order (newest saved first)
      matched.sort((a, b) => favIds.indexOf(a.id) - favIds.indexOf(b.id));
      setSavedNews(matched);
    } else {
      setSavedNews([]);
    }
  }, [news]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadNews(next, true);
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
    loadNews(1, false, query);
  }, [loadNews]);

  if (userLoading || !user) return null;

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="space-y-6 page-enter">
      {/* Daily mission */}
      <MissionCard userId={user.id} locale={locale} />

      {/* Search bar */}
      <SearchBar onSearch={handleSearch} locale={locale} />

      {/* Feed mode toggle — hidden during search */}
      {!isSearchActive && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <FeedModeToggle mode={feedMode} onChange={handleFeedModeChange} locale={locale} />
          {user.favoriteSports.length > 0 && (
            <span className="text-sm text-[var(--color-muted)]">
              {t('feed.personalized', locale)}
            </span>
          )}
        </div>
      )}

      {/* Saved / favorites strip */}
      {!isSearchActive && savedNews.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-muted)]">
              {'\u2764\uFE0F'} {t('favorites.title', locale)}
            </h3>
            {allFavoriteIds.length > MAX_SAVED_STRIP && (
              <span className="text-xs text-[var(--color-blue)] font-medium cursor-pointer hover:underline">
                {t('favorites.see_all', locale)} ({allFavoriteIds.length})
              </span>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {savedNews.slice(0, MAX_SAVED_STRIP).map((item) => (
              <a
                key={item.id}
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 w-48 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3 hover:shadow-sm transition-shadow"
              >
                <span className="text-xs text-[var(--color-muted)]">
                  {sportToEmoji(item.sport)} {getSportLabel(item.sport, locale)}
                </span>
                <p className="text-xs font-medium text-[var(--color-text)] mt-1 line-clamp-2 leading-snug">
                  {item.title}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recently Read (B-EN4) */}
      {!isSearchActive && recentlyRead.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--color-muted)]">
            {t('history.title', locale)}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {recentlyRead.map((item) => (
              <a
                key={item.id}
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 w-48 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3 hover:shadow-sm transition-shadow"
              >
                <span className="text-xs text-[var(--color-muted)]">
                  {sportToEmoji(item.sport)} {getSportLabel(item.sport, locale)}
                </span>
                <p className="text-xs font-medium text-[var(--color-text)] mt-1 line-clamp-2 leading-snug">
                  {item.title}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      <FiltersBar
        activeSport={activeSport}
        activeAge={activeAge}
        onSportChange={setActiveSport}
        onAgeChange={setActiveAge}
        locale={locale}
      />

      {parentalBlock && (
        <LimitReached
          type={parentalBlock.reason as any}
          allowedHoursStart={parentalBlock.allowedHoursStart}
          allowedHoursEnd={parentalBlock.allowedHoursEnd}
        />
      )}

      {error && !parentalBlock && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {!loading && news.length === 0 && !error && (
        isSearchActive ? (
          <EmptyState
            illustration="search"
            titleKey="empty.search_title"
            descriptionKey="empty.search_description"
            locale={locale}
          />
        ) : (
          <EmptyState
            illustration="news"
            titleKey="empty.news_title"
            descriptionKey="empty.news_description"
            locale={locale}
          />
        )
      )}

      {/* Headlines mode */}
      {feedMode === 'headlines' && (
        <div className="flex flex-col gap-2">
          {news.map((item) => (
            <HeadlineRow key={item.id} news={item} locale={locale} isTrending={trendingIds.has(item.id)} />
          ))}
        </div>
      )}

      {/* Cards mode */}
      {feedMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {news.map((item) => (
            <NewsCard key={item.id} news={item} locale={locale} isTrending={trendingIds.has(item.id)} />
          ))}
        </div>
      )}

      {/* Explain mode — cards with explain button always visible */}
      {feedMode === 'explain' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {news.map((item) => (
            <NewsCard key={item.id} news={item} locale={locale} showExplainButton isTrending={trendingIds.has(item.id)} />
          ))}
        </div>
      )}

      {loading && news.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      )}

      {loading && news.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="skeleton h-4 w-32 mx-auto" />
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
