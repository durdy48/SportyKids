'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { NewsItem, Reel, TeamStats } from '@sportykids/shared';
import { TEAMS, t } from '@sportykids/shared';
import { fetchNews, fetchReels, fetchTeamStats, updateUser } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { NewsCard } from '@/components/NewsCard';
import { TeamStatsCard } from '@/components/TeamStatsCard';
import { TeamReelsStrip } from '@/components/TeamReelsStrip';
import { TeamPageSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/EmptyState';
import { LimitReached } from '@/components/LimitReached';

export default function TeamPage() {
  const { user, loading: userLoading, setUser, locale } = useUser();
  const router = useRouter();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingTeam, setChangingTeam] = useState(false);
  const [parentalBlock, setParentalBlock] = useState<{ reason: string; allowedHoursStart?: number; allowedHoursEnd?: number } | null>(null);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace('/onboarding');
    }
  }, [userLoading, user, router]);

  const loadTeamData = useCallback(async () => {
    if (!user?.favoriteTeam) return;
    setLoading(true);
    setParentalBlock(null);
    try {
      const sport = user.favoriteSports?.[0];
      const [newsResult, reelsResult, statsResult] = await Promise.all([
        fetchNews({ team: user.favoriteTeam, limit: 30, userId: user.id }),
        fetchReels({ sport, limit: 20, userId: user.id }),
        fetchTeamStats(user.favoriteTeam),
      ]);
      setNews(newsResult.news);
      const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const teamNorm = user.favoriteTeam ? norm(user.favoriteTeam) : '';
      const teamReels = reelsResult.reels.filter(
        (r) => r.team && norm(r.team).includes(teamNorm)
      );
      setReels(teamReels);
      setTeamStats(statsResult);
    } catch (err: any) {
      if (err?.status === 403 && err?.reason) {
        setParentalBlock({ reason: err.reason, allowedHoursStart: err.allowedHoursStart, allowedHoursEnd: err.allowedHoursEnd });
      } else {
        console.error('Error loading team data:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.favoriteTeam, user?.id]);

  useEffect(() => {
    if (user?.favoriteTeam) {
      loadTeamData();
    } else {
      setLoading(false);
    }
  }, [loadTeamData, user?.favoriteTeam]);

  const changeTeam = async (team: string) => {
    if (!user) return;
    try {
      const updated = await updateUser(user.id, { favoriteTeam: team });
      setUser(updated);
      setChangingTeam(false);
    } catch (err) {
      console.error('Error updating team:', err);
    }
  };

  if (userLoading || !user) return null;

  if (parentalBlock) {
    return (
      <div className="space-y-6 page-enter">
        <LimitReached
          type={parentalBlock.reason as any}
          allowedHoursStart={parentalBlock.allowedHoursStart}
          allowedHoursEnd={parentalBlock.allowedHoursEnd}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Team header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
            {user.favoriteTeam ? `${'\u26BD'} ${user.favoriteTeam}` : t('team.my_team', locale)}
          </h2>
          <p className="text-[var(--color-muted)] text-sm mt-1">
            {user.favoriteTeam
              ? t('team.team_news', locale)
              : t('team.select_team', locale)}
          </p>
        </div>
        <button
          onClick={() => setChangingTeam(!changingTeam)}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-[var(--color-background)] text-[var(--color-muted)] hover:bg-[var(--color-border)] transition-colors"
        >
          {changingTeam ? t('buttons.cancel', locale) : t('buttons.change_team', locale)}
        </button>
      </div>

      {/* Team selector */}
      {(changingTeam || !user.favoriteTeam) && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-muted)] mb-4">{t('team.choose_favorite', locale)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TEAMS.map((team) => (
              <button
                key={team}
                onClick={() => changeTeam(team)}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors text-left ${
                  team === user.favoriteTeam
                    ? 'bg-[var(--color-blue)] text-white'
                    : 'bg-[var(--color-background)] text-[var(--color-muted)] hover:bg-[var(--color-border)]'
                }`}
              >
                {team}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Team content */}
      {user.favoriteTeam && !changingTeam && (
        <>
          {loading ? (
            <TeamPageSkeleton />
          ) : (
            <div className="space-y-6">
              {/* Team stats card */}
              {teamStats && (
                <TeamStatsCard stats={teamStats} locale={locale} />
              )}

              {/* Team reels strip */}
              {reels.length > 0 && (
                <TeamReelsStrip reels={reels} locale={locale} />
              )}

              {/* Team news */}
              <div>
                <h3 className="font-[family-name:var(--font-poppins)] text-lg font-semibold text-[var(--color-text)] mb-3">
                  {t('team.news', locale)}
                </h3>
                {news.length === 0 ? (
                  <EmptyState
                    illustration="news"
                    titleKey="empty.news_title"
                    descriptionKey="empty.news_description"
                    locale={locale}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {news.map((item) => (
                      <NewsCard key={item.id} news={item} locale={locale} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
