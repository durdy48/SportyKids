'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { NewsItem } from '@sportykids/shared';
import { TEAMS, t } from '@sportykids/shared';
import { fetchNews, updateUser } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { NewsCard } from '@/components/NewsCard';

export default function TeamPage() {
  const { user, loading: userLoading, setUser, locale } = useUser();
  const router = useRouter();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingTeam, setChangingTeam] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace('/onboarding');
    }
  }, [userLoading, user, router]);

  const loadNews = useCallback(async () => {
    if (!user?.favoriteTeam) return;
    setLoading(true);
    try {
      const result = await fetchNews({ team: user.favoriteTeam, limit: 30 });
      setNews(result.news);
    } catch (err) {
      console.error('Error loading team news:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.favoriteTeam]);

  useEffect(() => {
    if (user?.favoriteTeam) {
      loadNews();
    } else {
      setLoading(false);
    }
  }, [loadNews, user?.favoriteTeam]);

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
            {user.favoriteTeam ? `⚽ ${user.favoriteTeam}` : t('team.my_team', locale)}
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

      {/* Team feed */}
      {user.favoriteTeam && !changingTeam && (
        <>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-[var(--color-blue)] border-t-transparent rounded-full" />
            </div>
          ) : news.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">📭</p>
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
        </>
      )}
    </div>
  );
}
