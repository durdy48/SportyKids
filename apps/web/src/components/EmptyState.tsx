'use client';

import Link from 'next/link';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

type Illustration = 'news' | 'stickers' | 'quiz' | 'team' | 'reels' | 'search';

interface EmptyStateProps {
  illustration: Illustration;
  titleKey: string;
  descriptionKey?: string;
  ctaKey?: string;
  ctaHref?: string;
  locale: Locale;
}

function NewsIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Newspaper */}
      <rect x="16" y="20" width="52" height="56" rx="6" fill="#E2E8F0" />
      <rect x="20" y="28" width="44" height="4" rx="2" fill="#CBD5E1" />
      <rect x="20" y="36" width="32" height="3" rx="1.5" fill="#CBD5E1" />
      <rect x="20" y="43" width="38" height="3" rx="1.5" fill="#CBD5E1" />
      <rect x="20" y="52" width="20" height="16" rx="3" fill="#2563EB" opacity="0.2" />
      <rect x="44" y="52" width="20" height="3" rx="1.5" fill="#CBD5E1" />
      <rect x="44" y="59" width="16" height="3" rx="1.5" fill="#CBD5E1" />
      {/* Magnifying glass */}
      <circle cx="72" cy="60" r="12" stroke="#2563EB" strokeWidth="3" fill="white" />
      <line x1="81" y1="69" x2="88" y2="76" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StickersIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Album/book */}
      <rect x="18" y="16" width="48" height="64" rx="6" fill="#E2E8F0" />
      <rect x="22" y="20" width="40" height="56" rx="4" fill="white" stroke="#CBD5E1" strokeWidth="1.5" />
      {/* Empty card slots */}
      <rect x="28" y="28" width="14" height="18" rx="2" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 2" />
      <rect x="46" y="28" width="14" height="18" rx="2" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 2" />
      <rect x="28" y="50" width="14" height="18" rx="2" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 2" />
      {/* Sparkles */}
      <circle cx="74" cy="24" r="3" fill="#FACC15" />
      <circle cx="80" cy="36" r="2" fill="#FACC15" opacity="0.6" />
      <circle cx="70" cy="40" r="2.5" fill="#22C55E" />
      <path d="M78 16l2 4 2-4-2-4z" fill="#FACC15" />
    </svg>
  );
}

function QuizIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Lightbulb */}
      <circle cx="48" cy="38" r="22" fill="#FACC15" opacity="0.2" />
      <path d="M36 38c0-6.627 5.373-12 12-12s12 5.373 12 12c0 4.5-2.5 8.4-6 10.5V54H42v-5.5C38.5 46.4 36 42.5 36 38z" fill="#FACC15" />
      <rect x="42" y="54" width="12" height="4" rx="2" fill="#CBD5E1" />
      <rect x="44" y="60" width="8" height="3" rx="1.5" fill="#CBD5E1" />
      {/* Question mark */}
      <text x="48" y="44" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1E293B">?</text>
      {/* Rays */}
      <line x1="48" y1="8" x2="48" y2="14" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="20" x2="28" y2="24" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" />
      <line x1="72" y1="20" x2="68" y2="24" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="38" x2="24" y2="38" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" />
      <line x1="72" y1="38" x2="78" y2="38" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TeamIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Jersey/shirt */}
      <path d="M32 28L24 36V42L32 38V68H64V38L72 42V36L64 28H56C56 32.418 52.418 36 48 36C43.582 36 40 32.418 40 28H32Z"
        fill="#2563EB" opacity="0.2" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Number */}
      <text x="48" y="56" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#2563EB">10</text>
      {/* Star */}
      <path d="M48 18l1.5 3 3.5.5-2.5 2.5.5 3.5L48 25.5 45 27.5l.5-3.5L43 21.5l3.5-.5z" fill="#FACC15" />
    </svg>
  );
}

function ReelsIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Film strip */}
      <rect x="20" y="16" width="56" height="64" rx="6" fill="#E2E8F0" />
      {/* Perforations */}
      <rect x="24" y="20" width="6" height="4" rx="1" fill="#CBD5E1" />
      <rect x="24" y="28" width="6" height="4" rx="1" fill="#CBD5E1" />
      <rect x="24" y="36" width="6" height="4" rx="1" fill="#CBD5E1" />
      <rect x="66" y="20" width="6" height="4" rx="1" fill="#CBD5E1" />
      <rect x="66" y="28" width="6" height="4" rx="1" fill="#CBD5E1" />
      <rect x="66" y="36" width="6" height="4" rx="1" fill="#CBD5E1" />
      {/* Play button */}
      <circle cx="48" cy="48" r="16" fill="white" />
      <circle cx="48" cy="48" r="16" stroke="#22C55E" strokeWidth="2.5" />
      <path d="M43 38l14 10-14 10V38z" fill="#22C55E" />
    </svg>
  );
}

function SearchIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Magnifying glass */}
      <circle cx="42" cy="42" r="20" stroke="#2563EB" strokeWidth="3" fill="white" />
      <line x1="56" y1="56" x2="72" y2="72" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      {/* Question mark inside */}
      <text x="42" y="48" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#CBD5E1">?</text>
    </svg>
  );
}

const illustrations: Record<Illustration, React.FC> = {
  news: NewsIllustration,
  stickers: StickersIllustration,
  quiz: QuizIllustration,
  team: TeamIllustration,
  reels: ReelsIllustration,
  search: SearchIllustration,
};

export function EmptyState({
  illustration,
  titleKey,
  descriptionKey,
  ctaKey,
  ctaHref,
  locale,
}: EmptyStateProps) {
  const Svg = illustrations[illustration];

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Svg />
      <h3 className="mt-4 text-lg font-semibold text-[var(--color-text)] font-[family-name:var(--font-poppins)]">
        {t(titleKey, locale)}
      </h3>
      {descriptionKey && (
        <p className="mt-1 text-sm text-[var(--color-muted)] max-w-xs">
          {t(descriptionKey, locale)}
        </p>
      )}
      {ctaKey && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex items-center px-5 py-2.5 rounded-xl bg-[var(--color-blue)] text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {t(ctaKey, locale)}
        </Link>
      )}
    </div>
  );
}
