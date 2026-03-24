'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SPORTS, sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import type { Reel } from '@sportykids/shared';
import { fetchReels } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { useActivityTracker } from '@/lib/use-activity-tracker';
import { ReelCard } from '@/components/ReelCard';

export default function ReelsPage() {
  const { user, loading: userLoading, locale } = useUser();
  const router = useRouter();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useActivityTracker(user?.id, 'reels_viewed');

  useEffect(() => {
    if (!userLoading && !user) router.replace('/onboarding');
  }, [userLoading, user, router]);

  const load = useCallback(async (pg: number = 1, accumulate: boolean = false) => {
    if (!accumulate) setLoading(true);
    try {
      const result = await fetchReels({ sport: activeSport ?? undefined, page: pg, limit: 12 });
      setReels((prev) => accumulate ? [...prev, ...result.reels] : result.reels);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeSport]);

  useEffect(() => {
    if (user) {
      setPage(1);
      load(1, false);
    }
  }, [load, user]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    load(next, true);
  };

  if (userLoading || !user) return null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
          {t('reels.title', locale)}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {t('reels.subtitle', locale)}
        </p>
      </div>

      {/* Sport filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        <button
          onClick={() => { setActiveSport(null); setPage(1); setReels([]); }}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !activeSport
              ? 'bg-[var(--color-blue)] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t('filters.all', locale)}
        </button>
        {SPORTS.map((sport) => (
          <button
            key={sport}
            onClick={() => {
              setActiveSport(sport === activeSport ? null : sport);
              setPage(1);
              setReels([]);
            }}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sport === activeSport
                ? 'bg-[var(--color-blue)] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {sportToEmoji(sport)} {getSportLabel(sport, locale)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-[var(--color-blue)] border-t-transparent rounded-full" />
        </div>
      ) : reels.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">{'\u{1F3AC}'}</p>
          <p className="text-lg font-medium">{t('reels.no_reels', locale)}</p>
        </div>
      ) : (
        <>
          {/* Grid: 1 col mobile, 2 cols tablet, 3 cols desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reels.map((reel) => (
              <ReelCard key={reel.id} reel={reel} locale={locale} />
            ))}
          </div>

          {/* Load more */}
          {page < totalPages && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                className="px-6 py-3 bg-[var(--color-blue)] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                {t('buttons.load_more', locale)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
