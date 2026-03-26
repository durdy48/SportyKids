import { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import type { NewsItem } from '@sportykids/shared';
import { COLORS, t } from '@sportykids/shared';
import { fetchNews, fetchNewsSummary, fetchTrending } from '../lib/api';
import { BrandedRefreshControl } from '../components/BrandedRefreshControl';
import { NewsCard } from '../components/NewsCard';
import { NewsCardSkeleton } from '../components/NewsCardSkeleton';
import { FiltersBar } from '../components/FiltersBar';
import { StreakCounter } from '../components/StreakCounter';
import { useUser } from '../lib/user-context';

export function HomeFeedScreen({ navigation }: { navigation: any }) {
  const { user, locale, streakInfo } = useUser();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trendingIds, setTrendingIds] = useState<Set<string>>(new Set());

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
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const loadNews = useCallback(async (p: number, accumulate: boolean = false) => {
    try {
      const result = await fetchNews({
        sport: activeSport ?? undefined,
        userId: user?.id,
        q: searchQuery || undefined,
        page: p,
        limit: 20,
      });
      setNews((prev) => accumulate ? [...prev, ...result.news] : result.news);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error('Error loading news:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeSport, user?.id, searchQuery]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
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

  const handleExplainEasy = async (item: NewsItem) => {
    if (expandedSummaries[item.id]) {
      // Toggle off
      setExpandedSummaries((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
      return;
    }

    setLoadingSummary(item.id);
    try {
      const result = await fetchNewsSummary(item.id, user?.age ?? 10, locale);
      setExpandedSummaries((prev) => ({ ...prev, [item.id]: result.summary }));
    } catch {
      Alert.alert(
        t('summary.error', locale),
        t('summary.error', locale),
      );
    } finally {
      setLoadingSummary(null);
    }
  };

  const renderItem = ({ item }: { item: NewsItem }) => (
    <View>
      <NewsCard item={item} isTrending={trendingIds.has(item.id)} />
      <View style={styles.explainRow}>
        <TouchableOpacity
          style={styles.explainButton}
          onPress={() => handleExplainEasy(item)}
          disabled={loadingSummary === item.id}
        >
          {loadingSummary === item.id ? (
            <ActivityIndicator size="small" color={COLORS.blue} />
          ) : (
            <Text style={styles.explainText}>
              {expandedSummaries[item.id] ? '▲' : '▼'} {t('summary.explain_easy', locale)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      {expandedSummaries[item.id] ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{expandedSummaries[item.id]}</Text>
        </View>
      ) : null}
    </View>
  );

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
              <TouchableOpacity
                onPress={() => navigation.navigate('RssCatalog')}
                style={styles.settingsButton}
              >
                <Text style={styles.settingsIcon}>{'\u2699\uFE0F'}</Text>
              </TouchableOpacity>
            </View>
            {streakInfo && streakInfo.currentStreak > 0 && (
              <StreakCounter
                currentStreak={streakInfo.currentStreak}
                longestStreak={streakInfo.longestStreak}
                locale={locale}
              />
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
              />
              {searchInput.length > 0 && (
                <TouchableOpacity
                  onPress={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
                  style={styles.searchClear}
                >
                  <Text style={styles.searchClearText}>{'\u2715'}</Text>
                </TouchableOpacity>
              )}
            </View>
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
        refreshControl={<BrandedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  settingsButton: {
    padding: 8,
    marginTop: 2,
  },
  settingsIcon: {
    fontSize: 22,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#1E293B',
  },
  searchClear: {
    padding: 4,
    marginLeft: 4,
  },
  searchClearText: {
    fontSize: 14,
    color: '#9CA3AF',
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
    color: '#9CA3AF',
  },
  explainRow: {
    paddingHorizontal: 16,
    marginTop: -4,
    marginBottom: 8,
  },
  explainButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  explainText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.blue,
  },
  summaryBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.darkText,
    lineHeight: 20,
  },
});
