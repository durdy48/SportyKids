import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Dimensions, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Share, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Reel } from '@sportykids/shared';
import { SPORTS, COLORS, sportToEmoji, t, getSportLabel } from '@sportykids/shared';
import { fetchReels } from '../lib/api';
import { useUser } from '../lib/user-context';
import { SkeletonPlaceholder } from '../components/SkeletonPlaceholder';
import { WebView } from 'react-native-webview';
import { htmlEncode, getYouTubeThumbnail, getYouTubeVideoId } from '../lib/html-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_HEIGHT = SCREEN_WIDTH * (9 / 16); // 16:9 aspect ratio

const ItemSeparator = () => <View style={s.separator} />;

function getLikesStorageKey(userId?: string): string {
  return `sportykids_reel_likes_${userId || 'anon'}`;
}

export function ReelsScreen() {
  const { user, locale } = useUser();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const key = getLikesStorageKey(user?.id);
    AsyncStorage.getItem(key).then((val) => {
      if (val) setLikedIds(new Set(JSON.parse(val)));
    });
  }, [user?.id]);

  const saveLikes = (newSet: Set<string>) => {
    setLikedIds(newSet);
    const key = getLikesStorageKey(user?.id);
    AsyncStorage.setItem(key, JSON.stringify([...newSet]));
  };

  const toggleLike = (reelId: string) => {
    const newSet = new Set(likedIds);
    if (newSet.has(reelId)) newSet.delete(reelId);
    else newSet.add(reelId);
    saveLikes(newSet);
  };

  const handleShare = async (reel: Reel) => {
    try {
      await Share.share({ message: `${reel.title} - ${reel.videoUrl}` });
    } catch { /* cancelled */ }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErrorIds(new Set());
    setPlayingId(null);
    try {
      const data = await fetchReels({ sport: activeSport ?? undefined, limit: 20 });
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

  const renderReel = ({ item }: { item: Reel }) => {
    const isYouTube = item.videoType === 'youtube_embed' || item.videoUrl.includes('youtube.com') || item.videoUrl.includes('youtu.be');
    const isMP4 = item.videoType === 'mp4' || item.videoUrl.endsWith('.mp4');
    const thumbnail = item.thumbnailUrl || getYouTubeThumbnail(item.videoUrl);
    const isPlaying = playingId === item.id;
    const isLiked = likedIds.has(item.id);
    const hasError = errorIds.has(item.id);

    return (
      <View style={s.card}>
        {/* Video area */}
        <View style={s.videoArea}>
          {isPlaying && !hasError ? (
            renderPlayer(item, isYouTube, isMP4)
          ) : (
            <TouchableOpacity
              style={s.thumbnailContainer}
              onPress={() => {
                if (hasError) {
                  // Error: open in native app
                  const watchUrl = isYouTube ? `https://www.youtube.com/watch?v=${getYouTubeVideoId(item.videoUrl)}` : item.videoUrl;
                  Linking.openURL(watchUrl);
                } else {
                  setPlayingId(item.id);
                }
              }}
              activeOpacity={0.8}
            >
              {thumbnail ? (
                <Image source={{ uri: thumbnail }} style={s.thumbnailImage} />
              ) : (
                <View style={s.thumbnailPlaceholder}>
                  <Text style={{ fontSize: 40 }}>{sportToEmoji(item.sport)}</Text>
                </View>
              )}
              <View style={s.playOverlay}>
                {hasError ? (
                  <>
                    <View style={[s.playButton, { backgroundColor: '#c00' }]}>
                      <Text style={[s.playIcon, { color: '#fff' }]}>▶</Text>
                    </View>
                    <Text style={s.tapToPlayText}>{isYouTube ? 'YouTube' : t('reels.video_unavailable', locale)}</Text>
                  </>
                ) : (
                  <>
                    <View style={s.playButton}>
                      <Text style={s.playIcon}>▶</Text>
                    </View>
                  </>
                )}
              </View>
              {/* Duration badge */}
              {item.durationSeconds > 0 && (
                <View style={s.durationBadge}>
                  <Text style={s.durationText}>
                    {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, '0')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Info area */}
        <View style={s.info}>
          <View style={s.infoRow}>
            <View style={s.infoLeft}>
              <Text style={s.title} numberOfLines={2}>{item.title}</Text>
              <View style={s.meta}>
                <Text style={s.badge}>{sportToEmoji(item.sport)} {getSportLabel(item.sport, locale)}</Text>
                {item.team && <Text style={s.badge}>{item.team}</Text>}
                <Text style={s.source}>{item.source}</Text>
              </View>
            </View>
            <View style={s.actions}>
              <TouchableOpacity style={s.actionBtn} onPress={() => toggleLike(item.id)}>
                <Text style={{ fontSize: 20 }}>{isLiked ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => handleShare(item)}>
                <Text style={{ fontSize: 20 }}>📤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPlayer = (item: Reel, isYouTube: boolean, isMP4: boolean) => {
    if (isMP4) {
      const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}body{background:#000}</style></head><body><video src="${htmlEncode(item.videoUrl)}" controls autoplay playsinline style="width:100%;height:100%;object-fit:contain"></video></body></html>`;
      return (
        <WebView
          source={{ html }}
          style={s.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          scrollEnabled={false}
        />
      );
    }

    if (isYouTube) {
      const videoId = getYouTubeVideoId(item.videoUrl) ?? '';
      const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}body{background:#000}</style></head><body>
        <div id="player" style="width:100%;height:100%"></div>
        <script>
          var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.body.appendChild(tag);
          function onYouTubeIframeAPIReady(){new YT.Player('player',{width:'100%',height:'100%',videoId:'${htmlEncode(videoId)}',playerVars:{autoplay:1,playsinline:1,modestbranding:1,rel:0},events:{onError:function(){window.ReactNativeWebView.postMessage('EMBED_ERROR')}}});}
          setTimeout(function(){if(!document.querySelector('iframe'))window.ReactNativeWebView.postMessage('EMBED_ERROR');},8000);
        </script></body></html>`;
      return (
        <WebView
          source={{ html }}
          style={s.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          scrollEnabled={false}
          onMessage={(e) => {
            if (e.nativeEvent.data === 'EMBED_ERROR') {
              setErrorIds(prev => new Set([...prev, item.id]));
            }
          }}
          onError={() => setErrorIds(prev => new Set([...prev, item.id]))}
        />
      );
    }

    // Instagram, TikTok, other: iframe embed
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}body{background:#000}</style></head><body><iframe width="100%" height="100%" src="${htmlEncode(item.videoUrl)}" frameborder="0" allow="autoplay;encrypted-media" allowfullscreen style="border:0"></iframe></body></html>`;
    return (
      <WebView
        source={{ html }}
        style={s.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        scrollEnabled={false}
      />
    );
  };

  return (
    <View style={s.container}>
      {/* Sport filters */}
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
        <View style={{ flex: 1, padding: 12, gap: 12 }}>
          <SkeletonPlaceholder width="100%" height={VIDEO_HEIGHT} borderRadius={12} />
          <SkeletonPlaceholder width="75%" height={16} borderRadius={8} />
        </View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
          ItemSeparatorComponent={ItemSeparator}
          removeClippedSubviews={true}
          maxToRenderPerBatch={3}
          windowSize={5}
          renderItem={renderReel}
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
  container: { flex: 1, backgroundColor: '#111' },
  filters: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#222' },
  chipActive: { backgroundColor: COLORS.blue },
  chipText: { fontSize: 12, fontWeight: '500', color: '#999' },
  chipTextActive: { color: '#fff' },

  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoArea: {
    width: '100%',
    height: VIDEO_HEIGHT,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  thumbnailContainer: { flex: 1, position: 'relative' },
  thumbnailImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbnailPlaceholder: { flex: 1, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playButton: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  playIcon: { fontSize: 22, color: '#000', marginLeft: 3 },
  tapToPlayText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 6 },
  durationBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  errorOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  errorText: { color: '#888', fontSize: 13, marginTop: 8, marginBottom: 12 },
  openExternal: {
    backgroundColor: '#c00', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  openExternalText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  info: { padding: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoLeft: { flex: 1, marginRight: 8 },
  title: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  badge: {
    fontSize: 11, color: '#ccc', backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  source: { fontSize: 11, color: '#666' },
  actions: { flexDirection: 'row', gap: 12, paddingTop: 2 },
  actionBtn: { padding: 4 },

  separator: { height: 16 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 8 },
});
