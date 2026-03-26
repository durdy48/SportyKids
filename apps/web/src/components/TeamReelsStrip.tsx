'use client';

import type { Reel } from '@sportykids/shared';
import { t, getSportLabel, sportToEmoji } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

interface TeamReelsStripProps {
  reels: Reel[];
  locale: Locale;
}

export function TeamReelsStrip({ reels, locale }: TeamReelsStripProps) {
  if (reels.length === 0) return null;

  return (
    <div>
      <h3 className="font-[family-name:var(--font-poppins)] text-lg font-semibold text-[var(--color-text)] mb-3">
        {t('team.reels', locale)}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {reels.map((reel) => (
          <a
            key={reel.id}
            href={reel.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-36 group"
          >
            <div className="relative w-36 h-48 rounded-2xl overflow-hidden bg-[var(--color-border)]">
              {reel.thumbnailUrl ? (
                <img
                  src={reel.thumbnailUrl}
                  alt={reel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                  <span className="text-3xl">{'\u{1F3AC}'}</span>
                </div>
              )}
              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                  <span className="text-[var(--color-blue)] text-lg ml-0.5">{'\u25B6'}</span>
                </div>
              </div>
              {/* Duration badge */}
              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                {Math.floor(reel.durationSeconds / 60)}:{String(reel.durationSeconds % 60).padStart(2, '0')}
              </span>
              {/* Sport badge */}
              <span className="absolute top-2 left-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full">
                {sportToEmoji(reel.sport)}
              </span>
            </div>
            <p className="text-xs font-medium text-[var(--color-text)] mt-1.5 line-clamp-2 leading-snug">
              {reel.title}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
