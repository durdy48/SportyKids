'use client';

import { useState, useEffect, useRef } from 'react';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { fetchNewsSummary } from '@/lib/api';

interface AgeAdaptedSummaryProps {
  newsId: string;
  locale: Locale;
  userAge: number;
  isOpen: boolean;
}

export function AgeAdaptedSummary({ newsId, locale, userAge, isOpen }: AgeAdaptedSummaryProps) {
  const [summaryData, setSummaryData] = useState<{
    summary: string;
    ageRange: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!isOpen || hasFetched.current) return;

    hasFetched.current = true;
    setLoading(true);
    setError(false);

    fetchNewsSummary(newsId, userAge, locale)
      .then((data) => {
        setSummaryData({ summary: data.summary, ageRange: data.ageRange });
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, newsId, userAge, locale]);

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        maxHeight: isOpen ? '500px' : '0px',
        opacity: isOpen ? 1 : 0,
      }}
    >
      <div
        className="mt-3"
        style={{
          background: 'var(--color-background)',
          borderLeft: '3px solid var(--color-blue)',
          borderRadius: '8px',
          padding: '12px 16px',
        }}
      >
        {loading && (
          <div className="space-y-2">
            <div className="h-3 bg-[var(--color-border)] rounded animate-pulse w-3/4" />
            <div className="h-3 bg-[var(--color-border)] rounded animate-pulse w-full" />
            <div className="h-3 bg-[var(--color-border)] rounded animate-pulse w-2/3" />
            <p className="text-xs text-[var(--color-muted)] mt-2">
              {t('summary.loading', locale)}
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--color-muted)]">
            {t('summary.error', locale)}
          </p>
        )}

        {summaryData && !loading && !error && (
          <div>
            <span
              className="inline-block text-xs font-medium text-white px-2 py-0.5 rounded-full mb-2"
              style={{ backgroundColor: 'var(--color-green)' }}
            >
              {t('summary.adapted_for_age', locale, { range: summaryData.ageRange })}
            </span>
            <p className="text-sm text-[var(--color-text)] leading-relaxed">
              {summaryData.summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
