'use client';

import { useState, useCallback } from 'react';
import type { Reel } from '@sportykids/shared';
import { sportToEmoji, getSportLabel, t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { getLikedReels, toggleLike } from '@/lib/reel-likes';
import { ReportButton } from './ReportButton';

interface ReelCardProps {
  reel: Reel;
  locale: Locale;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ReelCard({ reel, locale }: ReelCardProps) {
  const [liked, setLiked] = useState(() => getLikedReels().has(reel.id));
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLike = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(toggleLike(reel.id));
  }, [reel.id]);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(reel.videoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [reel.videoUrl]);

  const buildEmbedUrl = (baseUrl: string, params: Record<string, string>): string => {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  };

  const embedUrl = playing
    ? buildEmbedUrl(reel.videoUrl, { autoplay: '1', mute: '0', controls: '1', modestbranding: '1', rel: '0' })
    : buildEmbedUrl(reel.videoUrl, { autoplay: '0', controls: '0', modestbranding: '1', rel: '0' });

  // Extract YouTube video ID for thumbnail
  const ytId = reel.videoUrl.match(/embed\/([a-zA-Z0-9_-]+)/)?.[1];
  const thumbnail = reel.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '');

  return (
    <div className="group rounded-2xl overflow-hidden bg-[var(--color-surface)] shadow-sm hover:shadow-md transition-shadow border border-[var(--color-border)]">
      {/* Video / Thumbnail area */}
      <div className="relative aspect-video bg-gray-900 cursor-pointer" onClick={() => setPlaying(!playing)}>
        {playing ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={reel.title}
          />
        ) : (
          <>
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={reel.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <span className="text-4xl">{sportToEmoji(reel.sport)}</span>
              </div>
            )}
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <span className="text-[var(--color-blue)] text-lg ml-0.5">{'\u25B6'}</span>
              </div>
            </div>
          </>
        )}

        {/* Duration badge */}
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {formatDuration(reel.durationSeconds)}
        </div>

        {/* Sport badge */}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
          {sportToEmoji(reel.sport)} {getSportLabel(reel.sport, locale)}
        </div>
      </div>

      {/* Info area */}
      <div className="p-3">
        <h3 className="font-[family-name:var(--font-poppins)] font-semibold text-sm text-[var(--color-text)] leading-snug line-clamp-2">
          {reel.title}
        </h3>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <span>{reel.source}</span>
            {reel.team && (
              <>
                <span>{'\u00B7'}</span>
                <span className="text-[var(--color-blue)]">{reel.team}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleLike}
              className={`p-1.5 rounded-full transition-colors ${liked ? 'text-red-500' : 'text-[var(--color-muted)] hover:text-red-400'}`}
              aria-label={t('reels.like', locale)}
            >
              <span className="text-sm">{liked ? '\u2764\uFE0F' : '\u{1F90D}'}</span>
            </button>
            <button
              onClick={handleShare}
              className="p-1.5 rounded-full text-[var(--color-muted)] hover:text-[var(--color-blue)] transition-colors"
              aria-label={t('reels.share', locale)}
            >
              <span className="text-sm">{copied ? '\u2705' : '\u{1F4E4}'}</span>
            </button>
            <ReportButton contentType="reel" contentId={reel.id} locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
}
