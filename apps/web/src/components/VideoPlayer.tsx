'use client';

import { useState, useRef } from 'react';
import { extractYouTubeVideoId, buildYouTubeEmbedUrl } from '@sportykids/shared';

interface VideoPlayerProps {
  videoUrl: string;
  videoType?: string;
  thumbnailUrl?: string;
  aspectRatio?: string;
}

/**
 * Native video player for web (B-MP6).
 * Uses HTML5 video for MP4/HLS sources, falls back to iframe for YouTube.
 * YouTube embeds use child-safe parameters from shared utility.
 * Iframes include sandbox attribute for security.
 */
export function VideoPlayer({ videoUrl, videoType, thumbnailUrl, aspectRatio }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
  const isMP4 = videoType === 'mp4' || videoUrl.endsWith('.mp4');

  const paddingTop = aspectRatio === '9:16' ? '177.78%' : '56.25%'; // 9:16 or 16:9

  /** Sandbox attribute for all iframes — restricts capabilities while allowing video playback. */
  const iframeSandbox = 'allow-scripts allow-same-origin allow-presentation';

  if (isYouTube) {
    const videoId = extractYouTubeVideoId(videoUrl);
    const embedUrl = buildYouTubeEmbedUrl(
      videoId ?? videoUrl,
      'web',
      isPlaying ? { autoplay: 1 } : {},
    );

    return (
      <div className="relative w-full" style={{ paddingTop }}>
        {!isPlaying && thumbnailUrl ? (
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={() => setIsPlaying(true)}
          >
            <img
              src={thumbnailUrl}
              alt="Video thumbnail"
              className="w-full h-full object-cover rounded-xl"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-black/60 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl ml-1">{'\u25B6'}</span>
              </div>
            </div>
          </div>
        ) : (
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full rounded-xl"
            allow="autoplay; encrypted-media"
            allowFullScreen={false}
            sandbox={iframeSandbox}
          />
        )}
      </div>
    );
  }

  if (isMP4) {
    return (
      <div className="relative w-full" style={{ paddingTop }}>
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnailUrl}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover rounded-xl"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>
    );
  }

  // Fallback: iframe for other embed URLs — only allow known video platforms
  const ALLOWED_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com'];
  const isAllowedUrl = (() => {
    try {
      const host = new URL(videoUrl).hostname;
      return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    } catch {
      return false;
    }
  })();

  if (!isAllowedUrl) {
    return (
      <div className="relative w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl p-8" style={{ paddingTop }}>
        <p className="absolute inset-0 flex items-center justify-center text-sm text-[var(--color-muted)]">
          Video not available — unsupported source
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ paddingTop }}>
      <iframe
        src={videoUrl}
        className="absolute inset-0 w-full h-full rounded-xl"
        allow="autoplay; encrypted-media"
        allowFullScreen={false}
        sandbox={iframeSandbox}
      />
    </div>
  );
}
