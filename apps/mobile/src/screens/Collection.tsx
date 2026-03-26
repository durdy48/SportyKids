import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { t, sportToEmoji, getSportLabel, SPORTS, COLORS } from '@sportykids/shared';
import type { Sticker, UserSticker, Achievement, UserAchievement } from '@sportykids/shared';
import { useUser } from '../lib/user-context';
import { SkeletonPlaceholder } from '../components/SkeletonPlaceholder';
import {
  getStickers,
  getUserStickers,
  getAchievements,
  getUserAchievements,
  getStreakInfo,
} from '../lib/api';

type Tab = 'stickers' | 'achievements';

export function CollectionScreen() {
  const { user, locale, loading: userLoading } = useUser();

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
    if (userLoading || !user) return;

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
  }, [user, userLoading]);

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
      <View style={styles.container}>
        <View style={[styles.content, { gap: 12 }]}>
          {/* Header skeleton */}
          <SkeletonPlaceholder width="60%" height={24} borderRadius={8} />
          <SkeletonPlaceholder width="40%" height={14} borderRadius={6} />
          {/* Progress bar skeleton */}
          <SkeletonPlaceholder width="100%" height={10} borderRadius={5} />
          {/* Grid skeleton */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={{ width: '47%' }}>
                <SkeletonPlaceholder width="100%" height={120} borderRadius={12} />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>{t('collection.title', locale)}</Text>
      <Text style={styles.subtitle}>
        {t('collection.stickers_collected', locale, {
          collected: String(collected),
          total: String(totalStickers),
        })}
      </Text>

      {/* Streak */}
      <View style={styles.streakRow}>
        <Text style={styles.streakEmoji}>🔥</Text>
        <Text style={styles.streakText}>{currentStreak}</Text>
        <Text style={styles.streakLabel}>
          {locale === 'es' ? 'racha actual' : 'current streak'}
        </Text>
        <Text style={styles.streakSeparator}>|</Text>
        <Text style={styles.streakText}>{longestStreak}</Text>
        <Text style={styles.streakLabel}>
          {locale === 'es' ? 'mejor racha' : 'best streak'}
        </Text>
      </View>

      {/* Points */}
      {user?.totalPoints != null && (
        <View style={styles.pointsRow}>
          <Text style={styles.pointsStar}>★</Text>
          <Text style={styles.pointsValue}>{user.totalPoints}</Text>
          <Text style={styles.pointsLabel}>{t('quiz.pts', locale)}</Text>
        </View>
      )}

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressPercent}%</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stickers' && styles.tabActive]}
          onPress={() => setActiveTab('stickers')}
        >
          <Text style={[styles.tabText, activeTab === 'stickers' && styles.tabTextActive]}>
            🎴 {locale === 'es' ? 'Stickers' : 'Stickers'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'achievements' && styles.tabActive]}
          onPress={() => setActiveTab('achievements')}
        >
          <Text style={[styles.tabText, activeTab === 'achievements' && styles.tabTextActive]}>
            🏆 {t('collection.achievements', locale)} ({unlockedCount}/{totalAchievements})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stickers tab */}
      {activeTab === 'stickers' && (
        <>
          {/* Sport filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[styles.filterChip, sportFilter === 'all' && styles.filterChipActive]}
              onPress={() => setSportFilter('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  sportFilter === 'all' && styles.filterChipTextActive,
                ]}
              >
                {t('collection.all_sports', locale)}
              </Text>
            </TouchableOpacity>
            {SPORTS.map((sport) => (
              <TouchableOpacity
                key={sport}
                style={[styles.filterChip, sportFilter === sport && styles.filterChipActive]}
                onPress={() => setSportFilter(sport)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    sportFilter === sport && styles.filterChipTextActive,
                  ]}
                >
                  {sportToEmoji(sport)} {getSportLabel(sport, locale)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Stickers grid */}
          {filteredStickers.length > 0 ? (
            <View style={styles.grid}>
              {filteredStickers.map((sticker) => {
                const owned = ownedStickerIds.has(sticker.id);
                return (
                  <View
                    key={sticker.id}
                    style={[styles.stickerCard, !owned && styles.stickerLocked]}
                  >
                    <Text style={styles.stickerEmoji}>{sticker.imageUrl || '🎴'}</Text>
                    <Text style={styles.stickerName} numberOfLines={1}>
                      {sticker.name}
                    </Text>
                    <Text style={styles.stickerRarity}>
                      {t(`sticker.rarity.${sticker.rarity}`, locale)}
                    </Text>
                    {!owned && (
                      <Text style={styles.lockedLabel}>{t('collection.locked', locale)}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎴</Text>
              <Text style={styles.emptyText}>{t('home.no_news', locale)}</Text>
            </View>
          )}
        </>
      )}

      {/* Achievements tab */}
      {activeTab === 'achievements' && (
        <View style={styles.achievementsList}>
          {allAchievements.map((achievement) => {
            const unlocked = unlockedAchievementIds.has(achievement.id);
            return (
              <View
                key={achievement.id}
                style={[styles.achievementCard, !unlocked && styles.achievementLocked]}
              >
                <Text style={styles.achievementIcon}>{achievement.icon || '🏆'}</Text>
                <View style={styles.achievementInfo}>
                  <Text style={styles.achievementName}>{achievement.name}</Text>
                  <Text style={styles.achievementDesc} numberOfLines={2}>
                    {achievement.description}
                  </Text>
                </View>
                {unlocked ? (
                  <Text style={styles.unlockedBadge}>✅</Text>
                ) : (
                  <Text style={styles.lockedBadge}>🔒</Text>
                )}
              </View>
            );
          })}
          {allAchievements.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={styles.emptyText}>{t('collection.achievements', locale)}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingTop: 56,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  streakEmoji: {
    fontSize: 18,
  },
  streakText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  streakLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  streakSeparator: {
    color: '#D1D5DB',
    marginHorizontal: 4,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 4,
  },
  pointsStar: {
    fontSize: 18,
    color: '#FACC15',
  },
  pointsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.blue,
    borderRadius: 5,
  },
  progressText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  tabActive: {
    backgroundColor: COLORS.blue,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: COLORS.blue,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stickerCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  stickerLocked: {
    opacity: 0.45,
  },
  stickerEmoji: {
    fontSize: 40,
    marginBottom: 6,
  },
  stickerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  stickerRarity: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  lockedLabel: {
    fontSize: 10,
    color: '#D1D5DB',
    marginTop: 4,
  },
  achievementsList: {
    gap: 10,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  achievementLocked: {
    opacity: 0.45,
  },
  achievementIcon: {
    fontSize: 30,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  achievementDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  unlockedBadge: {
    fontSize: 20,
  },
  lockedBadge: {
    fontSize: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
