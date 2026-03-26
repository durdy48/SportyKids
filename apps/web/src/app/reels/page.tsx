'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SPORTS, sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import type { Reel } from '@sportykids/shared';
import { fetchReels } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { useActivityTracker } from '@/lib/use-activity-tracker';
import { ReelCard } from '@/components/ReelCard';
import { ReelCardSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/EmptyState';
import { LimitReached } from '@/components/LimitReached';

export default function ReelsPage() {
  const { user, loading: userLoading, locale } = useUser();
  const router = useRouter();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [parentalBlock, setParentalBlock] = useState<{ reason: string; allowedHoursStart?: number; allowedHoursEnd?: number } | null>(null);

  useActivityTracker(user?.id, 'reels_viewed');

  useEffect(() => {
    if (!userLoading && !user) router.replace('/onboarding');
  }, [userLoading, user, router]);

  const load = useCallback(async (pg: number = 1, accumulate: boolean = false) => {
    if (!accumulate) setLoading(true);
    setParentalBlock(null);
    try {
      const result = await fetchReels({ sport: activeSport ?? undefined, page: pg, limit: 12, userId: user?.id });
      setReels((prev) => accumulate ? [...prev, ...result.reels] : result.reels);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      if (err?.status === 403 && err?.reason) {
        setParentalBlock({ reason: err.reason, allowedHoursStart: err.allowedHoursStart, allowedHoursEnd: err.allowedHoursEnd });
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }, [activeSport, user?.id]);

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
    <div className="page-enter">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
          {t('reels.title', locale)}
        </h2>
        <p className="text-[var(--color-muted)] text-sm mt-1">
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
              : 'bg-[var(--color-background)] text-[var(--color-muted)] hover:bg-[var(--color-border)]'
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
                : 'bg-[var(--color-background)] text-[var(--color-muted)] hover:bg-[var(--color-border)]'
            }`}
          >
            {sportToEmoji(sport)} {getSportLabel(sport, locale)}
          </button>
        ))}
      </div>

      {/* Parental block */}
      {parentalBlock && (
        <LimitReached
          type={parentalBlock.reason as any}
          allowedHoursStart={parentalBlock.allowedHoursStart}
          allowedHoursEnd={parentalBlock.allowedHoursEnd}
        />
      )}

      {/* Content */}
      {!parentalBlock && loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ReelCardSkeleton key={i} />
          ))}
        </div>
      ) : !parentalBlock && reels.length === 0 ? (
        <EmptyState
          illustration="reels"
          titleKey="empty.reels_title"
          descriptionKey="empty.reels_description"
          locale={locale}
        />
      ) : !parentalBlock ? (
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
      ) : null}
    </div>
  );
}
