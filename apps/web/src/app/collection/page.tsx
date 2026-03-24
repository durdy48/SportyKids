'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { t, sportToEmoji, getSportLabel, SPORTS } from '@sportykids/shared';
import type { Sticker, UserSticker, Achievement, UserAchievement } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';
import {
  getStickers,
  getUserStickers,
  getAchievements,
  getUserAchievements,
  getStreakInfo,
} from '@/lib/api';
import { StickerCard } from '@/components/StickerCard';
import { StreakCounter } from '@/components/StreakCounter';
import { AchievementBadge } from '@/components/AchievementBadge';

type Tab = 'stickers' | 'achievements';

export default function CollectionPage() {
  const { user, locale, loading: userLoading } = useUser();
  const router = useRouter();

  const [allStickers, setAllStickers] = useState<Sticker[]>([]);
  const [userStickers, setUserStickers] = useState<UserSticker[]>([]);
  const [collected, setCollected] = useState(0);
  const [totalStickers, setTotalStickers] = useState(0);

  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [totalAchievements, setTotalAchievements] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);

  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  const [sportFilter, setSportFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<Tab>('stickers');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push('/onboarding');
      return;
    }

    async function loadData() {
      setLoadingData(true);
      try {
        const [stickersRes, userStickersRes, achievementsRes, userAchievementsRes, streakRes] =
          await Promise.all([
            getStickers(),
            getUserStickers(user!.id),
            getAchievements(),
            getUserAchievements(user!.id),
            getStreakInfo(user!.id),
          ]);

        setAllStickers(stickersRes.stickers);
        setUserStickers(userStickersRes.stickers);
        setCollected(userStickersRes.collected);
        setTotalStickers(userStickersRes.total);

        setAllAchievements(achievementsRes.achievements);
        setUserAchievements(userAchievementsRes.achievements);
        setTotalAchievements(userAchievementsRes.total);
        setUnlockedCount(userAchievementsRes.unlocked);

        setCurrentStreak(streakRes.currentStreak);
        setLongestStreak(streakRes.longestStreak);
      } catch {
        // API not available yet — show empty state
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [user, userLoading, router]);

  const ownedStickerIds = useMemo(
    () => new Set(userStickers.map((us) => us.stickerId)),
    [userStickers],
  );

  const unlockedAchievementIds = useMemo(
    () => new Set(userAchievements.map((ua) => ua.achievementId)),
    [userAchievements],
  );

  const filteredStickers = useMemo(() => {
    if (sportFilter === 'all') return allStickers;
    return allStickers.filter((s) => s.sport === sportFilter);
  }, [allStickers, sportFilter]);

  const progressPercent = totalStickers > 0 ? Math.round((collected / totalStickers) * 100) : 0;

  if (userLoading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 animate-pulse">{t('buttons.loading', locale)}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
            {t('collection.title', locale)}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('collection.stickers_collected', locale, {
              collected: String(collected),
              total: String(totalStickers),
            })}
          </p>
        </div>
        <StreakCounter
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          locale={locale}
        />
      </div>

      {/* Points */}
      {user?.totalPoints != null && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[var(--color-yellow)] text-lg">&#9733;</span>
          <span className="font-bold text-[var(--color-text)]">{user.totalPoints}</span>
          <span className="text-sm text-gray-400">{t('quiz.pts', locale)}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-blue)] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">{progressPercent}%</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('stickers')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'stickers'
              ? 'bg-[var(--color-blue)] text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {t('collection.stickers_collected', locale, { collected: String(collected), total: String(totalStickers) })}
        </button>
        <button
          onClick={() => setActiveTab('achievements')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'achievements'
              ? 'bg-[var(--color-blue)] text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          🏆 {t('collection.achievements', locale)} ({unlockedCount}/{totalAchievements})
        </button>
      </div>

      {/* Stickers tab */}
      {activeTab === 'stickers' && (
        <>
          {/* Sport filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            <button
              onClick={() => setSportFilter('all')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sportFilter === 'all'
                  ? 'bg-[var(--color-blue)] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('collection.all_sports', locale)}
            </button>
            {SPORTS.map((sport) => (
              <button
                key={sport}
                onClick={() => setSportFilter(sport)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  sportFilter === sport
                    ? 'bg-[var(--color-blue)] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {sportToEmoji(sport)} {getSportLabel(sport, locale)}
              </button>
            ))}
          </div>

          {/* Stickers grid */}
          {filteredStickers.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredStickers.map((sticker) => (
                <StickerCard
                  key={sticker.id}
                  sticker={sticker}
                  owned={ownedStickerIds.has(sticker.id)}
                  locale={locale}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🎴</p>
              <p>{t('home.no_news', locale)}</p>
            </div>
          )}
        </>
      )}

      {/* Achievements tab */}
      {activeTab === 'achievements' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {allAchievements.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              unlocked={unlockedAchievementIds.has(achievement.id)}
              locale={locale}
            />
          ))}
          {allAchievements.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🏆</p>
              <p>{t('collection.achievements', locale)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
