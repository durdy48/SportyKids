'use client';

import { useState } from 'react';
import type { Sticker } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { t, sportToColor, sportToEmoji } from '@sportykids/shared';
import { RARITY_COLORS } from '@sportykids/shared';

interface StickerCardProps {
  sticker: Sticker;
  owned: boolean;
  locale: Locale;
}

export function StickerCard({ sticker, owned, locale }: StickerCardProps) {
  const [imgError, setImgError] = useState(false);
  const rarityColor = RARITY_COLORS[sticker.rarity] ?? '#94A3B8';
  const rarityLabel = t(`sticker.rarity.${sticker.rarity}`, locale);
  const sportColor = sportToColor(sticker.sport);
  const sportEmoji = sportToEmoji(sticker.sport);

  const glowClass =
    sticker.rarity === 'legendary'
      ? 'animate-pulse'
      : sticker.rarity === 'epic' || sticker.rarity === 'rare'
        ? 'shadow-lg'
        : '';

  return (
    <div
      aria-label={owned ? `${sticker.name} sticker, ${rarityLabel} rarity` : `Locked sticker, ${rarityLabel} rarity`}
      className={`relative rounded-xl overflow-hidden transition-transform hover:scale-105 ${glowClass} ${
        !owned ? 'grayscale opacity-60' : ''
      }`}
      style={{
        border: `3px solid ${owned ? rarityColor : '#CBD5E1'}`,
        boxShadow:
          owned && sticker.rarity !== 'common'
            ? `0 0 12px ${rarityColor}40`
            : undefined,
      }}
    >
      {/* Image area */}
      <div
        className="relative w-full aspect-square flex items-center justify-center"
        style={{ backgroundColor: `${sportColor}15` }}
      >
        {owned ? (
          sticker.imageUrl && !imgError ? (
            <img
              src={sticker.imageUrl}
              alt={sticker.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-4xl">{sportEmoji}</span>
          )
        ) : (
          <span className="text-4xl text-[var(--color-muted)]">?</span>
        )}
      </div>

      {/* Info area */}
      <div className="p-2 bg-[var(--color-surface)]">
        <p className="text-xs font-semibold text-[var(--color-text)] truncate">
          {owned ? sticker.name : '???'}
        </p>
        <span
          className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
          style={{ backgroundColor: rarityColor }}
        >
          {rarityLabel}
        </span>
      </div>
    </div>
  );
}
