'use client';

import type { Reel } from '@sportykids/shared';
import { sportToEmoji, getSportLabel } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

interface ReelCardProps {
  reel: Reel;
  locale: Locale;
}

export function ReelCard({ reel, locale }: ReelCardProps) {
  return (
    <div className="snap-start h-[80vh] min-h-[500px] flex items-center justify-center p-4">
      <div className="bg-black rounded-3xl overflow-hidden w-full max-w-sm h-full flex flex-col shadow-2xl">
        {/* Embedded video */}
        <div className="flex-1 relative">
          <iframe
            src={`${reel.videoUrl}?autoplay=0&controls=1&modestbranding=1`}
            className="w-full h-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={reel.title}
          />
        </div>

        {/* Reel info */}
        <div className="bg-gradient-to-t from-black/90 to-black/60 p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-white/20 text-xs px-2.5 py-1 rounded-full font-medium">
              {sportToEmoji(reel.sport)} {getSportLabel(reel.sport, locale)}
            </span>
            {reel.team && (
              <span className="bg-[var(--color-blue)]/30 text-xs px-2.5 py-1 rounded-full font-medium">
                {reel.team}
              </span>
            )}
            <span className="text-xs text-white/60 ml-auto">
              {Math.floor(reel.durationSeconds / 60)}:{String(reel.durationSeconds % 60).padStart(2, '0')}
            </span>
          </div>
          <h3 className="font-[family-name:var(--font-poppins)] font-semibold text-base leading-snug">
            {reel.title}
          </h3>
          <p className="text-xs text-white/50 mt-1">{reel.source}</p>
        </div>
      </div>
    </div>
  );
}
