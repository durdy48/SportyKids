import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { NewsItem, TeamStats } from '@sportykids/shared';
import { TEAMS, t } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import { fetchNews, fetchTeamStats, updateUser } from '../lib/api';
import { useUser } from '../lib/user-context';
import { NewsCard } from '../components/NewsCard';
import { SkeletonPlaceholder } from '../components/SkeletonPlaceholder';

export function FavoriteTeamScreen() {
  const { user, setUser, locale, colors } = useUser();
  const s = createStyles(colors);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.favoriteTeam) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [newsResult, stats] = await Promise.all([
        fetchNews({ team: user.favoriteTeam, limit: 30 }),
        fetchTeamStats(user.favoriteTeam),
      ]);
      setNews(newsResult.news);
      setTeamStats(stats);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.favoriteTeam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const changeTeam = async (team: string) => {
    if (!user) return;
    try {
      const updated = await updateUser(user.id, { favoriteTeam: team });
      setUser(updated);
      setChanging(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  if (!user) return null;

  if (!user.favoriteTeam || changing) {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ padding: 16 }}>
        <Text style={s.title}>{t('team.choose_favorite', locale)}</Text>
        <View style={s.grid}>
          {TEAMS.map((team) => (
            <TouchableOpacity
              key={team}
              style={[s.teamChip, team === user.favoriteTeam && s.teamActive]}
              onPress={() => changeTeam(team)}
            >
              <Text style={[s.teamText, team === user.favoriteTeam && { color: '#fff' }]}>{team}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {changing && (
          <TouchableOpacity style={s.cancel} onPress={() => setChanging(false)}>
            <Text style={s.cancelText}>{t('buttons.cancel', locale)}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  const renderHeader = () => (
    <View>
      <View style={s.header}>
        <Text style={s.title}>{user.favoriteTeam}</Text>
        <TouchableOpacity onPress={() => setChanging(true)}>
          <Text style={s.change}>{t('buttons.change_team', locale)}</Text>
        </TouchableOpacity>
      </View>

      {/* Team Stats Section */}
      {loading ? (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SkeletonPlaceholder width="100%" height={60} borderRadius={12} />
          <SkeletonPlaceholder width="100%" height={60} borderRadius={12} />
          <SkeletonPlaceholder width="100%" height={80} borderRadius={12} />
        </View>
      ) : teamStats ? (
        <View style={s.statsContainer}>
          {/* League Position */}
          {teamStats.leaguePosition != null && (
            <View style={s.statCard}>
              <Text style={s.statCardLabel}>{t('team.league_position', locale)}</Text>
              <Text style={s.statCardValue}>{teamStats.leaguePosition}º</Text>
            </View>
          )}

          {/* Top Scorer */}
          {teamStats.topScorer && (
            <View style={s.statCard}>
              <Text style={s.statCardLabel}>{t('team.top_scorer', locale)}</Text>
              <Text style={s.statCardValueSmall}>{teamStats.topScorer}</Text>
            </View>
          )}

          {/* Recent Results */}
          {teamStats.recentResults.length > 0 && (
            <View style={s.resultsCard}>
              <Text style={s.statCardLabel}>{t('team.recent_results', locale)}</Text>
              <View style={s.resultsRow}>
                {teamStats.recentResults.slice(0, 5).map((result, idx) => {
                  const bgColor = result.result === 'W' ? colors.green
                    : result.result === 'D' ? colors.yellow
                    : '#EF4444';
                  const resultLabel = result.result === 'W' ? t('team.win', locale)
                    : result.result === 'D' ? t('team.draw', locale)
                    : t('team.loss', locale);
                  return (
                    <View key={idx} style={s.resultItem}>
                      <View style={[s.resultBadge, { backgroundColor: bgColor }]}>
                        <Text style={s.resultBadgeText}>{resultLabel}</Text>
                      </View>
                      <Text style={s.resultScore}>{result.score}</Text>
                      <Text style={s.resultOpponent} numberOfLines={1}>{result.opponent}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Next Match */}
          {teamStats.nextMatch && (
            <View style={s.nextMatchCard}>
              <Text style={s.statCardLabel}>{t('team.next_match', locale)}</Text>
              <Text style={s.nextMatchOpponent}>{teamStats.nextMatch.opponent}</Text>
              <Text style={s.nextMatchMeta}>
                {teamStats.nextMatch.competition} · {new Date(teamStats.nextMatch.date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Team News Header */}
      <Text style={s.newsHeader}>{t('team.news', locale)}</Text>
    </View>
  );

  return (
    <View style={s.container}>
      <FlatList
        data={news}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NewsCard item={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>📭</Text>
              <Text style={s.emptyText}>
                {t('team.no_recent_news', locale, { team: user.favoriteTeam })}
              </Text>
              <Text style={s.emptyHint}>{t('team.news_sync_hint', locale)}</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  change: { fontSize: 14, color: colors.blue, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  teamChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.border, minWidth: '45%' },
  teamActive: { backgroundColor: colors.blue },
  teamText: { fontSize: 14, fontWeight: '500', color: colors.muted },
  cancel: { marginTop: 20, alignItems: 'center' },
  cancelText: { fontSize: 14, color: colors.muted },

  // Stats section
  statsContainer: { paddingHorizontal: 16, gap: 10 },
  statCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  statCardLabel: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  statCardValue: { fontSize: 32, fontWeight: '700', color: colors.blue },
  statCardValueSmall: { fontSize: 16, fontWeight: '600', color: colors.text },

  resultsCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  resultsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  resultItem: { flex: 1, alignItems: 'center', gap: 4 },
  resultBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  resultBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  resultScore: { fontSize: 11, fontWeight: '600', color: colors.text },
  resultOpponent: { fontSize: 9, color: colors.muted, textAlign: 'center' },

  nextMatchCard: {
    backgroundColor: colors.blue + '15', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.blue + '30',
  },
  nextMatchOpponent: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 6 },
  nextMatchMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },

  newsHeader: { fontSize: 18, fontWeight: '600', color: colors.text, paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: colors.muted, marginTop: 8 },
  emptyHint: { fontSize: 13, color: colors.muted, marginTop: 4 },
  });
}
