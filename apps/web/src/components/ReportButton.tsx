'use client';

import { useState, useRef, useEffect } from 'react';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';
import { submitReport } from '@/lib/api';

interface ReportButtonProps {
  contentType: 'news' | 'reel';
  contentId: string;
  locale: Locale;
}

type State = 'idle' | 'selecting' | 'sending' | 'sent' | 'error';

const REASONS = [
  { key: 'inappropriate', emoji: '\uD83D\uDE20' },
  { key: 'scary', emoji: '\uD83D\uDE28' },
  { key: 'confusing', emoji: '\uD83E\uDD14' },
  { key: 'other', emoji: '\u2753' },
] as const;

export function ReportButton({ contentType, contentId, locale }: ReportButtonProps) {
  const { user } = useUser();
  const [state, setState] = useState<State>('idle');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (state !== 'selecting') return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setState('idle');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [state]);

  if (!user) return null;

  const handleSelect = async (reason: string) => {
    setState('sending');
    try {
      await submitReport({
        userId: user.id,
        contentType,
        contentId,
        reason,
      });
      setState('sent');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setState(state === 'selecting' ? 'idle' : 'selecting');
        }}
        disabled={state === 'sending' || state === 'sent' || state === 'error'}
        className="text-xs text-[var(--color-muted)] hover:text-red-400 transition-colors px-1.5 py-0.5 rounded"
        aria-label={t('report.flag', locale)}
      >
        {state === 'sent' ? '\u2705' : state === 'error' ? '\u274C' : '\uD83D\uDEA9'}
        {' '}
        <span className="hidden sm:inline">
          {state === 'sent'
            ? t('report.sent', locale)
            : state === 'error'
              ? t('report.error', locale)
              : t('report.flag', locale)}
        </span>
      </button>

      {state === 'selecting' && (
        <div className="absolute bottom-full mb-1 right-0 z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-2 min-w-[180px]">
          <p className="text-xs text-[var(--color-muted)] font-medium px-2 py-1 mb-1">
            {t('report.why', locale)}
          </p>
          {REASONS.map(({ key, emoji }) => (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(key);
              }}
              className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-[var(--color-background)] transition-colors flex items-center gap-2"
            >
              <span>{emoji}</span>
              <span>{t(`report.${key}`, locale)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
