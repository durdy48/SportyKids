import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, Linking } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { Locale } from '@sportykids/shared';
import { t } from '@sportykids/shared';
import { htmlEncode, getYouTubeWatchUrl } from '../lib/html-utils';

interface VideoPlayerProps {
  videoUrl: string;
  videoType?: string;
  thumbnailUrl?: string;
  aspectRatio?: string;
  locale?: Locale;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Native video player for mobile.
 *
 * Strategy:
 * - MP4: expo-video inline (native player)
 * - YouTube/Instagram/TikTok: WebView embed with error detection.
 *   If embed fails (e.g. YouTube error 153), shows a "Watch in app" fallback button.
 */
export function VideoPlayer({ videoUrl, videoType, thumbnailUrl, aspectRatio, locale = 'es' }: VideoPlayerProps) {
  const [embedError, setEmbedError] = useState(false);

  const isYouTube = videoType === 'youtube_embed' || videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
  const isMP4 = videoType === 'mp4' || videoUrl.endsWith('.mp4');
  const isInstagram = videoType === 'instagram_embed';
  const isTikTok = videoType === 'tiktok_embed';

  const videoHeight = aspectRatio === '9:16'
    ? SCREEN_WIDTH * (16 / 9)
    : SCREEN_WIDTH * (9 / 16);

  // MP4: use expo-video inline
  if (isMP4) {
    try {
      return <ExpoVideoPlayer videoUrl={videoUrl} height={videoHeight} />;
    } catch {
      // expo-video not available — fall through to WebView
    }
  }

  // Embed error fallback: offer to open in native app
  if (embedError) {
    const openExternal = () => {
      if (isYouTube) Linking.openURL(getYouTubeWatchUrl(videoUrl));
      else Linking.openURL(videoUrl);
    };

    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>🎬</Text>
        <Text style={styles.errorText}>
          {isYouTube ? t('reels.video_inline_error', locale) : t('reels.video_unavailable', locale)}
        </Text>
        <TouchableOpacity style={styles.errorButton} onPress={openExternal}>
          <Text style={styles.errorButtonText}>
            {isYouTube ? t('reels.open_in_youtube', locale) : t('reels.open_video', locale)}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Build embed HTML with error detection JS
  let embedHtml: string;
  if (isYouTube) {
    embedHtml = getYouTubeEmbed(videoUrl);
  } else if (isInstagram) {
    embedHtml = getInstagramEmbed(videoUrl);
  } else if (isTikTok) {
    embedHtml = getTikTokEmbed(videoUrl);
  } else {
    embedHtml = `<video src="${htmlEncode(videoUrl)}" controls autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>`;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>*{margin:0;padding:0}body{background:#000;overflow:hidden}</style>
    </head>
    <body>${embedHtml}</body>
    </html>
  `;

  const onMessage = (event: WebViewMessageEvent) => {
    if (event.nativeEvent.data === 'EMBED_ERROR') {
      setEmbedError(true);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        scrollEnabled={false}
        onMessage={onMessage}
        onError={() => setEmbedError(true)}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 400) setEmbedError(true);
        }}
      />
    </View>
  );
}

function getYouTubeEmbed(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=))([^?&]+)/);
  const videoId = match?.[1] ?? '';
  // Use YouTube IFrame Player API directly (not raw iframe) to get onError callback.
  // Error codes 101/150 = embed restricted (error 153 in UI).
  return `
    <div id="player" style="width:100%;height:100%"></div>
    <script>
      var tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      function onYouTubeIframeAPIReady() {
        new YT.Player('player', {
          width: '100%',
          height: '100%',
          videoId: '${htmlEncode(videoId)}',
          playerVars: { autoplay: 1, playsinline: 1, modestbranding: 1, rel: 0 },
          events: {
            onError: function(e) {
              window.ReactNativeWebView.postMessage('EMBED_ERROR');
            }
          }
        });
      }
      // Fallback: if API doesn't load in 8s, report error
      setTimeout(function() {
        if (!document.querySelector('iframe')) {
          window.ReactNativeWebView.postMessage('EMBED_ERROR');
        }
      }, 8000);
    </script>`;
}

function getInstagramEmbed(url: string): string {
  return `<iframe width="100%" height="100%" src="${htmlEncode(url)}" frameborder="0" allow="autoplay;encrypted-media" allowfullscreen style="border:0"></iframe>`;
}

function getTikTokEmbed(url: string): string {
  return `<iframe width="100%" height="100%" src="${htmlEncode(url)}" frameborder="0" allow="autoplay;encrypted-media" allowfullscreen style="border:0"></iframe>`;
}

/**
 * Expo Video player wrapper. Only used when expo-video is available.
 */
function ExpoVideoPlayer({ videoUrl, height }: { videoUrl: string; height: number }) {
  try {
    const { VideoView, useVideoPlayer } = require('expo-video');
    const player = useVideoPlayer(videoUrl, (p: { loop: boolean }) => {
      p.loop = false;
    });

    return (
      <View style={[styles.container, { height }]}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          allowsFullscreen
          allowsPictureInPicture
        />
      </View>
    );
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
    borderRadius: 12,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    padding: 24,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
