'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SPORTS, sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import type { Reel } from '@sportykids/shared';
import { fetchReels } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { ReelCard } from '@/components/ReelCard';

export default function ReelsPage() {
  const { user, loading: userLoading, locale } = useUser();
  const router = useRouter();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && !user) router.replace('/onboarding');
  }, [userLoading, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchReels({ sport: activeSport ?? undefined, limit: 20 });
      setReels(result.reels);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeSport]);

  useEffect(() => {
    if (user) load();
  }, [load, user]);

  if (userLoading || !user) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
          {t('reels.title', locale)}
        </h2>
        <p className="text-gray-500 text-sm mt-1">{t('reels.subtitle', locale)}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSport(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !activeSport ? 'bg-[var(--color-blue)] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          {t('filters.all', locale)}
        </button>
        {SPORTS.map((sport) => (
          <button
            key={sport}
            onClick={() => setActiveSport(sport === activeSport ? null : sport)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sport === activeSport ? 'bg-[var(--color-blue)] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {sportToEmoji(sport)} {getSportLabel(sport, locale)}
          </button>
        ))}
      </div>

      {/* Vertical feed with scroll snap */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-[var(--color-blue)] border-t-transparent rounded-full" />
        </div>
      ) : reels.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">🎬</p>
          <p className="text-lg font-medium">{t('reels.no_reels', locale)}</p>
        </div>
      ) : (
        <div className="snap-y snap-mandatory overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {reels.map((reel) => (
            <ReelCard key={reel.id} reel={reel} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
