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

export default function TeamPage() {
  const { user, loading: userLoading, setUser, locale } = useUser();
  const router = useRouter();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingTeam, setChangingTeam] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace('/onboarding');
    }
  }, [userLoading, user, router]);

  const loadTeamData = useCallback(async () => {
    if (!user?.favoriteTeam) return;
    setLoading(true);
    try {
      // Pass first favorite sport to filter reels server-side
      const sport = user.favoriteSports?.[0];
      const [newsResult, reelsResult, statsResult] = await Promise.all([
        fetchNews({ team: user.favoriteTeam, limit: 30 }),
        fetchReels({ sport, limit: 20 }),
        fetchTeamStats(user.favoriteTeam),
      ]);
      setNews(newsResult.news);
      // Further filter reels by team name if possible
      const teamReels = reelsResult.reels.filter(
        (r) => r.team && r.team.toLowerCase() === user.favoriteTeam?.toLowerCase()
      );
      setReels(teamReels.length > 0 ? teamReels : reelsResult.reels.slice(0, 6));
      setTeamStats(statsResult);
    } catch (err) {
      console.error('Error loading team data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.favoriteTeam]);

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

  return (
    <div className="space-y-6">
      {/* Team header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
            {user.favoriteTeam ? `${'\u26BD'} ${user.favoriteTeam}` : t('team.my_team', locale)}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {user.favoriteTeam
              ? t('team.team_news', locale)
              : t('team.select_team', locale)}
          </p>
        </div>
        <button
          onClick={() => setChangingTeam(!changingTeam)}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          {changingTeam ? t('buttons.cancel', locale) : t('buttons.change_team', locale)}
        </button>
      </div>

      {/* Team selector */}
      {(changingTeam || !user.favoriteTeam) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-4">{t('team.choose_favorite', locale)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TEAMS.map((team) => (
              <button
                key={team}
                onClick={() => changeTeam(team)}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors text-left ${
                  team === user.favoriteTeam
                    ? 'bg-[var(--color-blue)] text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
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
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-[var(--color-blue)] border-t-transparent rounded-full" />
            </div>
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
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-2">{'\u{1F4ED}'}</p>
                    <p className="text-lg font-medium">
                      {t('team.no_recent_news', locale, { team: user.favoriteTeam })}
                    </p>
                    <p className="text-sm">{t('team.news_sync_hint', locale)}</p>
                  </div>
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
