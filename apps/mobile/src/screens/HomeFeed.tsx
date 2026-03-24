import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import type { NewsItem } from '@sportykids/shared';
import { COLORS, t } from '@sportykids/shared';
import { fetchNews, fetchNewsSummary } from '../lib/api';
import { NewsCard } from '../components/NewsCard';
import { FiltersBar } from '../components/FiltersBar';
import { useUser } from '../lib/user-context';

export function HomeFeedScreen() {
  const { user, locale } = useUser();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);

  const loadNews = useCallback(async (p: number, accumulate: boolean = false) => {
    try {
      const result = await fetchNews({
        sport: activeSport ?? undefined,
        userId: user?.id,
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
  }, [activeSport, user?.id]);

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
      <NewsCard item={item} />
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
            <Text style={styles.title}>{t('home.latest_news', locale)}</Text>
            <Text style={styles.subtitle}>
              {user ? t('feed.personalized', locale) : t('home.subtitle', locale)}
            </Text>
            <FiltersBar activeSport={activeSport} onSportChange={setActiveSport} />
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏟️</Text>
              <Text style={styles.emptyText}>{t('home.no_news', locale)}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? <ActivityIndicator size="large" color={COLORS.blue} style={{ padding: 20 }} /> : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
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
