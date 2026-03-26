import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Dimensions, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import type { Reel } from '@sportykids/shared';
import { SPORTS, COLORS, sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import { fetchReels } from '../lib/api';
import { useUser } from '../lib/user-context';
import { SkeletonPlaceholder } from '../components/SkeletonPlaceholder';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const REEL_HEIGHT = SCREEN_HEIGHT - 160;
const LIKES_STORAGE_KEY = 'sportykids_reel_likes';

function getYouTubeThumbnail(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (match) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  return null;
}

export function ReelsScreen() {
  const { user, locale } = useUser();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Load liked reels from storage
  useEffect(() => {
    AsyncStorage.getItem(LIKES_STORAGE_KEY).then((val) => {
      if (val) setLikedIds(new Set(JSON.parse(val)));
    });
  }, []);

  const saveLikes = (newSet: Set<string>) => {
    setLikedIds(newSet);
    AsyncStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify([...newSet]));
  };

  const toggleLike = (reelId: string) => {
    const newSet = new Set(likedIds);
    if (newSet.has(reelId)) {
      newSet.delete(reelId);
    } else {
      newSet.add(reelId);
    }
    saveLikes(newSet);
  };

  const handleShare = async (reel: Reel) => {
    try {
      await Share.share({
        message: `${reel.title} - ${reel.videoUrl}`,
      });
    } catch {
      // User cancelled or share failed
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReels({
        sport: activeSport ?? undefined,
        limit: 20,
      });
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
        <View style={{ flex: 1, padding: 8, gap: 16 }}>
          <SkeletonPlaceholder width="100%" height={REEL_HEIGHT * 0.7} borderRadius={16} />
          <SkeletonPlaceholder width="75%" height={18} borderRadius={8} />
          <SkeletonPlaceholder width="40%" height={14} borderRadius={8} />
        </View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={REEL_HEIGHT}
          decelerationRate="fast"
          renderItem={({ item }) => {
            const thumbnail = item.thumbnailUrl || getYouTubeThumbnail(item.videoUrl);
            const isPlaying = playingId === item.id;
            const isLiked = likedIds.has(item.id);

            return (
              <View style={[s.reelContainer, { height: REEL_HEIGHT }]}>
                <View style={s.videoContainer}>
                  {isPlaying ? (
                    <WebView
                      source={{ uri: item.videoUrl }}
                      style={s.video}
                      allowsInlineMediaPlayback
                    />
                  ) : (
                    <TouchableOpacity
                      style={s.thumbnailContainer}
                      onPress={() => setPlayingId(item.id)}
                      activeOpacity={0.8}
                    >
                      {thumbnail ? (
                        <Image source={{ uri: thumbnail }} style={s.thumbnailImage} />
                      ) : (
                        <View style={s.thumbnailPlaceholder}>
                          <Text style={{ fontSize: 48 }}>🎬</Text>
                        </View>
                      )}
                      <View style={s.playOverlay}>
                        <View style={s.playButton}>
                          <Text style={s.playIcon}>▶</Text>
                        </View>
                        <Text style={s.tapToPlay}>{t('reels.tap_to_play', locale)}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={s.info}>
                  <View style={s.infoTop}>
                    <View style={s.infoLeft}>
                      <View style={s.badges}>
                        <Text style={s.badge}>
                          {sportToEmoji(item.sport)} {getSportLabel(item.sport, locale)}
                        </Text>
                        {item.team && <Text style={s.badge}>{item.team}</Text>}
                      </View>
                      <Text style={s.title} numberOfLines={2}>{item.title}</Text>
                      <Text style={s.source}>{item.source}</Text>
                    </View>

                    <View style={s.actions}>
                      <TouchableOpacity style={s.actionBtn} onPress={() => toggleLike(item.id)}>
                        <Text style={{ fontSize: 22 }}>{isLiked ? '❤️' : '🤍'}</Text>
                        <Text style={s.actionLabel}>{t('reels.like', locale)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actionBtn} onPress={() => handleShare(item)}>
                        <Text style={{ fontSize: 22 }}>📤</Text>
                        <Text style={s.actionLabel}>{t('reels.share', locale)}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
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
  thumbnailContainer: { flex: 1, position: 'relative' },
  thumbnailImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbnailPlaceholder: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  playIcon: { fontSize: 24, color: '#000', marginLeft: 4 },
  tapToPlay: { color: '#fff', fontSize: 13, fontWeight: '500', marginTop: 8 },
  info: { padding: 12 },
  infoTop: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLeft: { flex: 1, marginRight: 12 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  badge: {
    fontSize: 11, color: '#ccc', backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  source: { fontSize: 12, color: '#666' },
  actions: { alignItems: 'center', gap: 12 },
  actionBtn: { alignItems: 'center' },
  actionLabel: { fontSize: 10, color: '#999', marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 8 },
});
