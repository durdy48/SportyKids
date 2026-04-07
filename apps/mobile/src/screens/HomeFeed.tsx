import { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, Text, StyleSheet, TouchableOpacity, TextInput, Linking, ScrollView as HScrollView } from 'react-native';
import type { NewsItem } from '@sportykids/shared';
import { t, sportToEmoji, getSportLabel } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import { fetchNews, fetchTrending, fetchReadingHistory } from '../lib/api';
import { BrandedRefreshControl } from '../components/BrandedRefreshControl';
import { NewsCard } from '../components/NewsCard';
import { NewsCardSkeleton } from '../components/NewsCardSkeleton';
import { FiltersBar } from '../components/FiltersBar';
import { StreakCounter } from '../components/StreakCounter';
import { MissionCard } from '../components/MissionCard';
import { useUser } from '../lib/user-context';

export function HomeFeedScreen({ navigation }: { navigation: { navigate: (screen: string) => void } }) {
  const { user, locale, streakInfo, colors } = useUser();
  const styles = createStyles(colors);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trendingIds, setTrendingIds] = useState<Set<string>>(new Set());
  const [recentlyRead, setRecentlyRead] = useState<NewsItem[]>([]);
  const [scheduleLock, setScheduleLock] = useState<{ locked: boolean; start: number; end: number } | null>(null);
  const [subscriptionBlock, setSubscriptionBlock] = useState<{ type: string; allowedSports?: string[] } | null>(null);

  const handleSearchChange = useCallback((text: string) => {
    setSearchInput(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(text.trim());
      setPage(1);
    }, 300);
  }, []);

  useEffect(() => {
    fetchTrending().then((res) => setTrendingIds(new Set(res.trendingIds)));
    if (user?.id) {
      fetchReadingHistory(user.id, 1, 5).then((res) => setRecentlyRead(res.history)).catch((e) => {
        // eslint-disable-next-line no-console
        __DEV__ && console.warn('Failed to fetch reading history:', e);
      });
    }
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [user?.id]);

  const loadNews = useCallback(async (p: number, accumulate: boolean = false) => {
    try {
      const result = await fetchNews({
        sport: activeSport ?? undefined,
        userId: user?.id,
        q: searchQuery || undefined,
        locale,
        page: p,
        limit: 20,
      });
      setNews((prev) => accumulate ? [...prev, ...result.news] : result.news);
      setTotalPages(result.totalPages);
    } catch (err) {
      const e = err as Error & { scheduleLocked?: boolean; allowedHoursStart?: number; allowedHoursEnd?: number; subscriptionError?: boolean; limitType?: string; allowedSports?: string[]; formatBlocked?: boolean };
      if (e.scheduleLocked) {
        setScheduleLock({ locked: true, start: e.allowedHoursStart ?? 0, end: e.allowedHoursEnd ?? 24 });
      } else if (e.subscriptionError) {
        setNews([]);
        setSubscriptionBlock({ type: e.limitType ?? 'sport', allowedSports: e.allowedSports });
      } else if (e.formatBlocked) {
        setNews([]);
        setSubscriptionBlock({ type: 'format_blocked' });
      } else {
        // eslint-disable-next-line no-console
        console.error('Error loading news:', err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeSport, user?.id, searchQuery, locale]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    setSubscriptionBlock(null);
    loadNews(1);
  }, [loadNews]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadNews(1);
  };

  const loadMore = () => {
    if (page >= totalPages) return;
    const next = page + 1;
    setPage(next);
    loadNews(next, true);
  };

  const renderItem = ({ item }: { item: NewsItem }) => (
    <NewsCard item={item} isTrending={trendingIds.has(item.id)} />
  );

  // Content blocked — parental restriction or subscription limit
  if (subscriptionBlock) {
    const isParentalBlock = subscriptionBlock.type === 'format_blocked';
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>{isParentalBlock ? '\u{1F6AB}' : '\u26BD'}</Text>
        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 22, color: colors.text, textAlign: 'center', marginBottom: 8 }}>
          {isParentalBlock ? t('parental.blocked_content', locale) : t('subscription.limit_reached_sport', locale)}
        </Text>
        <Text style={{ fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 20 }}>
          {isParentalBlock ? t('parental.blocked_by_parent', locale) : t('subscription.limit_reached_cta', locale)}
        </Text>
        {!isParentalBlock && (
          <>
            <TouchableOpacity
              style={{ backgroundColor: colors.blue, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginBottom: 12 }}
              onPress={() => { setSubscriptionBlock(null); setActiveSport(null); setPage(1); }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('home.latest_news', locale)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
              onPress={() => navigation.navigate('Upgrade')}
            >
              <Text style={{ color: colors.blue, fontWeight: '600', fontSize: 15 }}>{t('subscription.upgrade', locale)}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  // Schedule lock screen — friendly bedtime message
  if (scheduleLock?.locked) {
    const formatHour = (h: number) => `${h}:00`;
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>&#x1F319;</Text>
        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 22, color: colors.text, textAlign: 'center', marginBottom: 8 }}>
          {t('schedule.locked_title', locale)}
        </Text>
        <Text style={{ fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 20 }}>
          {t('schedule.locked_message', locale, { start: formatHour(scheduleLock.start), end: formatHour(scheduleLock.end) })}
        </Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, color: colors.muted }}>
            {t('schedule.available_hours', locale)}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.blue, marginTop: 4 }}>
            {formatHour(scheduleLock.start)} – {formatHour(scheduleLock.end)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={news}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t('home.latest_news', locale)}</Text>
                <Text style={styles.subtitle}>
                  {user ? t('feed.personalized', locale) : t('home.subtitle', locale)}
                </Text>
              </View>
            </View>
            {streakInfo && streakInfo.currentStreak > 0 && (
              <StreakCounter
                currentStreak={streakInfo.currentStreak}
                longestStreak={streakInfo.longestStreak}
                locale={locale}
              />
            )}
            {user && (
              <MissionCard userId={user.id} locale={locale} colors={colors} />
            )}
            {/* Search bar */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>{'\u{1F50D}'}</Text>
              <TextInput
                style={styles.searchInput}
                value={searchInput}
                onChangeText={handleSearchChange}
                placeholder={t('search.placeholder', locale)}
                placeholderTextColor="#9CA3AF"
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel={t('a11y.common.search', locale)}
              />
              {searchInput.length > 0 && (
                <TouchableOpacity
                  onPress={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
                  style={styles.searchClear}
                  accessible={true}
                  accessibilityLabel={t('a11y.common.clear_search', locale)}
                  accessibilityRole="button"
                >
                  <Text style={styles.searchClearText}>{'\u2715'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Recently Read (B-EN4) */}
            {recentlyRead.length > 0 && (
              <View style={styles.recentlyReadSection}>
                <Text style={styles.recentlyReadTitle}>{t('history.title', locale)}</Text>
                <HScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {recentlyRead.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.recentlyReadCard}
                      onPress={() => Linking.openURL(item.sourceUrl)}
                      accessible={true}
                      accessibilityLabel={t('a11y.news_card.read', locale, { title: item.title })}
                      accessibilityRole="link"
                    >
                      <Text style={styles.recentlyReadSport}>
                        {sportToEmoji(item.sport)} {getSportLabel(item.sport, locale)}
                      </Text>
                      <Text style={styles.recentlyReadCardTitle} numberOfLines={2}>{item.title}</Text>
                    </TouchableOpacity>
                  ))}
                </HScrollView>
              </View>
            )}

            <FiltersBar activeSport={activeSport} onSportChange={setActiveSport} />
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{searchQuery ? '\u{1F50D}' : '\u{1F3DF}\uFE0F'}</Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? t('search.no_results', locale).replace('{query}', searchQuery)
                  : t('home.no_news', locale)}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View>
              {Array.from({ length: news.length === 0 ? 4 : 1 }).map((_, i) => (
                <NewsCardSkeleton key={i} />
              ))}
            </View>
          ) : null
        }
        refreshControl={<BrandedRefreshControl refreshing={refreshing} onRefresh={onRefresh} locale={locale} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      marginTop: 4,
      marginBottom: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    searchIcon: {
      fontSize: 14,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      height: 40,
      fontSize: 14,
      color: colors.text,
    },
    searchClear: {
      padding: 4,
      marginLeft: 4,
    },
    searchClearText: {
      fontSize: 14,
      color: colors.muted,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyEmoji: {
      fontSize: 48,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.muted,
    },
    recentlyReadSection: {
      marginBottom: 12,
    },
    recentlyReadTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 8,
    },
    recentlyReadCard: {
      width: 160,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
    },
    recentlyReadSport: {
      fontSize: 11,
      color: colors.muted,
      marginBottom: 4,
    },
    recentlyReadCardTitle: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
      lineHeight: 16,
    },
  });
}
