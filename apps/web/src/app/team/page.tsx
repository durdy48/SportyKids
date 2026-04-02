'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { NewsItem, Reel, TeamStats, LiveMatchData } from '@sportykids/shared';
import { TEAMS, t } from '@sportykids/shared';
import { fetchNews, fetchReels, fetchTeamStats, updateUser, getLiveMatch } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { NewsCard } from '@/components/NewsCard';
import { TeamStatsCard } from '@/components/TeamStatsCard';
import { TeamReelsStrip } from '@/components/TeamReelsStrip';
import { TeamPageSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/EmptyState';
import { LimitReached, type LimitType } from '@/components/LimitReached';

export default function TeamPage() {
  const { user, loading: userLoading, setUser, locale } = useUser();
  const router = useRouter();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [liveMatch, setLiveMatch] = useState<LiveMatchData | null>(null);
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
      const [newsResult, reelsResult, statsResult, liveResult] = await Promise.all([
        fetchNews({ team: user.favoriteTeam, limit: 30, userId: user.id }),
        fetchReels({ sport, limit: 20, userId: user.id }),
        fetchTeamStats(user.favoriteTeam),
        getLiveMatch(user.favoriteTeam),
      ]);
      setNews(newsResult.news);
      setLiveMatch(liveResult);
      const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const teamNorm = user.favoriteTeam ? norm(user.favoriteTeam) : '';
      const teamReels = reelsResult.reels.filter(
        (r) => r.team && norm(r.team).includes(teamNorm)
      );
      setReels(teamReels);
      setTeamStats(statsResult);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e?.status === 403 && e?.reason) {
        setParentalBlock({ reason: e.reason as string, allowedHoursStart: e.allowedHoursStart as number, allowedHoursEnd: e.allowedHoursEnd as number });
      } else {
        // eslint-disable-next-line no-console
        console.error('Error loading team data:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.favoriteTeam, user?.id, user?.favoriteSports]);

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
      // eslint-disable-next-line no-console
      console.error('Error updating team:', err);
    }
  };

  if (userLoading || !user) return null;

  if (parentalBlock) {
    return (
      <div className="space-y-6 page-enter">
        <LimitReached
          type={parentalBlock.reason as LimitType}
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
              {/* Live match banner */}
              {liveMatch && (liveMatch.status === 'live' || liveMatch.status === 'half_time') && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 animate-pulse-slow">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">
                      {t(`live_scores.${liveMatch.status === 'half_time' ? 'half_time' : 'live'}`, locale)}
                    </span>
                    {liveMatch.league && (
                      <span className="text-xs text-[var(--color-muted)] ml-auto">{liveMatch.league}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-4 text-lg font-bold text-[var(--color-text)]">
                    <span className="text-right flex-1">{liveMatch.homeTeam}</span>
                    <span className="text-2xl font-extrabold text-red-600 dark:text-red-400">
                      {liveMatch.homeScore} - {liveMatch.awayScore}
                    </span>
                    <span className="text-left flex-1">{liveMatch.awayTeam}</span>
                  </div>
                  {liveMatch.progress && (
                    <p className="text-center text-xs text-[var(--color-muted)] mt-1">
                      {liveMatch.progress}{'\u2032'}
                    </p>
                  )}
                </div>
              )}

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
