'use client';

import { useState, useCallback } from 'react';
import type { Reel } from '@sportykids/shared';
import { sportToEmoji, getSportLabel, t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { getLikedReels, toggleLike } from '@/lib/reel-likes';

interface ReelPlayerProps {
  reel: Reel;
  isActive: boolean;
  locale: Locale;
}

export function ReelPlayer({ reel, isActive, locale }: ReelPlayerProps) {
  const [liked, setLiked] = useState(() => getLikedReels().has(reel.id));
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(isActive);

  const handleLike = useCallback(() => {
    const newState = toggleLike(reel.id);
    setLiked(newState);
  }, [reel.id]);

  const handleShare = useCallback(async () => {
    const url = reel.videoUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore
    }
  }, [reel.videoUrl]);

  const handleTap = () => {
    setPlaying((prev) => !prev);
  };

  // Build YouTube embed URL with autoplay when active
  const buildEmbedUrl = (baseUrl: string, params: Record<string, string>): string => {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  };

  const embedUrl = isActive && playing
    ? buildEmbedUrl(reel.videoUrl, { autoplay: '1', mute: '1', controls: '0', modestbranding: '1', rel: '0' })
    : buildEmbedUrl(reel.videoUrl, { autoplay: '0', controls: '1', modestbranding: '1', rel: '0' });

  return (
    <div className="reel-item relative w-full h-screen max-h-[100dvh] flex items-center justify-center bg-black">
      {/* Video container */}
      <div
        className="relative w-full max-w-sm h-full cursor-pointer"
        onClick={handleTap}
      >
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={reel.title}
        />

        {/* Tap to play overlay when paused */}
        {!playing && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <span className="text-[var(--color-blue)] text-2xl ml-1">{'\u25B6'}</span>
            </div>
            <span className="absolute bottom-20 text-white/70 text-sm">
              {t('reels.tap_to_play', locale)}
            </span>
          </div>
        )}
      </div>

      {/* Overlay: info at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pb-8 pointer-events-none">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-white/20 text-xs px-2.5 py-1 rounded-full font-medium text-white">
              {sportToEmoji(reel.sport)} {getSportLabel(reel.sport, locale)}
            </span>
            {reel.team && (
              <span className="bg-[var(--color-blue)]/40 text-xs px-2.5 py-1 rounded-full font-medium text-white">
                {reel.team}
              </span>
            )}
          </div>
          <h3 className="font-[family-name:var(--font-poppins)] font-semibold text-white text-base leading-snug">
            {reel.title}
          </h3>
          <p className="text-xs text-white/50 mt-1">{reel.source}</p>
        </div>
      </div>

      {/* Side buttons */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-5 pointer-events-auto">
        {/* Like */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1"
          aria-label={t('reels.like', locale)}
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
            liked ? 'bg-red-500' : 'bg-white/20'
          }`}>
            <span className="text-xl">{liked ? '\u2764\uFE0F' : '\u{1F90D}'}</span>
          </div>
          <span className="text-white text-[10px]">{t('reels.like', locale)}</span>
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1"
          aria-label={t('reels.share', locale)}
        >
          <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-xl">{'\u{1F4E4}'}</span>
          </div>
          <span className="text-white text-[10px]">
            {copied ? t('reels.copied', locale) : t('reels.share', locale)}
          </span>
        </button>
      </div>
    </div>
  );
}
