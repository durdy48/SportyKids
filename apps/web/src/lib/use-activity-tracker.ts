'use client';

import { useEffect, useRef } from 'react';

export function useActivityTracker(
  userId: string | undefined,
  type: string,
  contentId?: string,
  sport?: string
) {
  const startTime = useRef(Date.now());

  useEffect(() => {
    startTime.current = Date.now();
    return () => {
      if (!userId) return;
      const duration = Math.round((Date.now() - startTime.current) / 1000);
      if (duration < 2) return; // Skip very short visits
      const data = JSON.stringify({
        userId,
        type,
        durationSeconds: duration,
        contentId,
        sport,
      });
      const url = `${
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      }/parents/activity/log`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          url,
          new Blob([data], { type: 'application/json' })
        );
      } else {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true,
        });
      }
    };
  }, [userId, type, contentId, sport]);
}
