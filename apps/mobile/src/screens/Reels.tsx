import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Dimensions, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { Reel } from '@sportykids/shared';
import { SPORTS, COLORS, sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import { useUser } from '../lib/user-context';

const API_BASE = 'http://localhost:3001/api';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const REEL_HEIGHT = SCREEN_HEIGHT - 160;

export function ReelsScreen() {
  const { user, locale } = useUser();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (activeSport) params.set('sport', activeSport);
      const res = await fetch(`${API_BASE}/reels?${params}`);
      const data = await res.json();
      setReels(data.reels);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeSport]);

  useEffect(() => {
    if (user) load();
  }, [load, user]);

  if (!user) return null;

  return (
    <View style={s.container}>
      {/* Filters */}
      <FlatList
        horizontal
        data={[null, ...SPORTS]}
        keyExtractor={(item) => item ?? 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.chip, (item === activeSport || (!item && !activeSport)) && s.chipActive]}
            onPress={() => setActiveSport(item === activeSport ? null : item)}
          >
            <Text style={[s.chipText, (item === activeSport || (!item && !activeSport)) && s.chipTextActive]}>
              {item ? `${sportToEmoji(item)} ${getSportLabel(item, locale)}` : t('filters.all', locale)}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.blue} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={REEL_HEIGHT}
          decelerationRate="fast"
          renderItem={({ item }) => (
            <View style={[s.reelContainer, { height: REEL_HEIGHT }]}>
              <View style={s.videoContainer}>
                <WebView
                  source={{ uri: item.videoUrl }}
                  style={s.video}
                  allowsInlineMediaPlayback
                />
              </View>
              <View style={s.info}>
                <View style={s.badges}>
                  <Text style={s.badge}>{sportToEmoji(item.sport)} {getSportLabel(item.sport, locale)}</Text>
                  {item.team && <Text style={s.badge}>{item.team}</Text>}
                </View>
                <Text style={s.title}>{item.title}</Text>
                <Text style={s.source}>{item.source}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>🎬</Text>
              <Text style={s.emptyText}>{t('reels.no_reels', locale)}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  filters: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#222' },
  chipActive: { backgroundColor: COLORS.blue },
  chipText: { fontSize: 12, fontWeight: '500', color: '#999' },
  chipTextActive: { color: '#fff' },
  reelContainer: { backgroundColor: '#000' },
  videoContainer: { flex: 1, borderRadius: 16, overflow: 'hidden', margin: 8 },
  video: { flex: 1, backgroundColor: '#111' },
  info: { padding: 12 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  badge: { fontSize: 11, color: '#ccc', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  source: { fontSize: 12, color: '#666' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 8 },
});
