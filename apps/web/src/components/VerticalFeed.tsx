'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Reel } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { ReelPlayer } from './ReelPlayer';

interface VerticalFeedProps {
  reels: Reel[];
  locale: Locale;
  onLoadMore?: () => void;
}

export function VerticalFeed({ reels, locale, onLoadMore }: VerticalFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const reelRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // IntersectionObserver to detect active reel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index)) {
              setActiveIndex(index);

              // Trigger load more when near last reel
              if (onLoadMore && index >= reels.length - 2) {
                onLoadMore();
              }
            }
          }
        }
      },
      {
        root: container,
        threshold: 0.6,
      }
    );

    reelRefs.current.forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels.length, onLoadMore]);

  const setReelRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      reelRefs.current.set(index, el);
    } else {
      reelRefs.current.delete(index);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="reel-container h-screen overflow-y-auto"
    >
      {reels.map((reel, index) => (
        <div
          key={reel.id}
          ref={(el) => setReelRef(index, el)}
          data-index={index}
          className="reel-item"
        >
          <ReelPlayer
            reel={reel}
            isActive={index === activeIndex}
            locale={locale}
          />
        </div>
      ))}
    </div>
  );
}
