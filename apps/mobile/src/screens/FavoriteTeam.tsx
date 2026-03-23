import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { NewsItem } from '@sportykids/shared';
import { TEAMS, COLORS, t } from '@sportykids/shared';
import { fetchNews } from '../lib/api';
import { useUser } from '../lib/user-context';
import { NewsCard } from '../components/NewsCard';

const API_BASE = 'http://192.168.1.189:3001/api';

export function FavoriteTeamScreen() {
  const { user, setUser, locale } = useUser();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);

  const loadNews = useCallback(async () => {
    if (!user?.favoriteTeam) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchNews({ team: user.favoriteTeam, limit: 30 });
      setNews(result.news);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.favoriteTeam]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const changeTeam = async (team: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favoriteTeam: team }),
      });
      if (res.ok) {
        setUser(await res.json());
        setChanging(false);
      }
    } catch (err) {
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

  return (
    <View style={s.container}>
      <FlatList
        data={news}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NewsCard item={item} />}
        ListHeaderComponent={
          <View style={s.header}>
            <Text style={s.title}>{user.favoriteTeam}</Text>
            <TouchableOpacity onPress={() => setChanging(true)}>
              <Text style={s.change}>{t('buttons.change_team', locale)}</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>📭</Text>
              <Text style={s.emptyText}>
                {t('team.no_recent_news', locale, { team: user.favoriteTeam })}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.darkText },
  change: { fontSize: 14, color: COLORS.blue, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  teamChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', minWidth: '45%' },
  teamActive: { backgroundColor: COLORS.blue },
  teamText: { fontSize: 14, fontWeight: '500', color: '#4B5563' },
  cancel: { marginTop: 20, alignItems: 'center' },
  cancelText: { fontSize: 14, color: '#9CA3AF' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 8 },
});
