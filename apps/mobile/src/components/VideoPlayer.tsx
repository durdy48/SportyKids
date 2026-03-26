import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface VideoPlayerProps {
  videoUrl: string;
  videoType?: string;
  thumbnailUrl?: string;
  aspectRatio?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Native video player for mobile (B-MP6).
 *
 * For MP4: Uses expo-video when available, falls back to WebView.
 * For YouTube: Uses WebView with embedded iframe.
 */
export function VideoPlayer({ videoUrl, videoType, thumbnailUrl, aspectRatio }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
  const isMP4 = videoType === 'mp4' || videoUrl.endsWith('.mp4');

  const videoHeight = aspectRatio === '9:16'
    ? SCREEN_WIDTH * (16 / 9)
    : SCREEN_WIDTH * (9 / 16);

  if (isMP4) {
    // Try expo-video, fall back to WebView
    try {
      const { VideoView, useVideoPlayer } = require('expo-video');
      return <ExpoVideoPlayer videoUrl={videoUrl} height={videoHeight} />;
    } catch {
      // expo-video not installed — use WebView fallback
    }
  }

  // YouTube or fallback: WebView with embedded player
  const embedHtml = isYouTube
    ? getYouTubeEmbed(videoUrl)
    : `<video src="${videoUrl}" controls autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}body{background:#000}</style></head>
    <body>${embedHtml}</body>
    </html>
  `;

  return (
    <View style={[styles.container, { height: videoHeight }]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
      />
    </View>
  );
}

function getYouTubeEmbed(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=))([^?&]+)/);
  const videoId = match?.[1] ?? '';
  return `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1" frameborder="0" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
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
    width: SCREEN_WIDTH,
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
});
