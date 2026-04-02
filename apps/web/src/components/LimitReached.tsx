'use client';

import { useRouter } from 'next/navigation';
import { t } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';

export type LimitType = 'limit_reached' | 'format_blocked' | 'sport_blocked' | 'schedule_locked' | 'news_limit_reached' | 'reels_limit_reached' | 'quiz_limit_reached' | 'subscription_limit_reached' | 'subscription_sport_restricted';

interface LimitReachedProps {
  type?: LimitType;
  allowedHoursStart?: number;
  allowedHoursEnd?: number;
}

const EMOJIS: Record<LimitType, string> = {
  limit_reached: '\u{1F634}',
  format_blocked: '\u{1F6AB}',
  sport_blocked: '\u{26BD}',
  schedule_locked: '\u{1F319}',
  news_limit_reached: '\u{1F4F0}',
  reels_limit_reached: '\u{1F3AC}',
  quiz_limit_reached: '\u{1F9E0}',
  subscription_limit_reached: '\u{1F512}',
  subscription_sport_restricted: '\u{26BD}',
};

const MESSAGE_KEYS: Record<LimitType, { title: string; message: string }> = {
  limit_reached: {
    title: 'limit.reached_title',
    message: 'limit.reached_message',
  },
  format_blocked: {
    title: 'limit.reached_title',
    message: 'limit.format_blocked',
  },
  sport_blocked: {
    title: 'limit.reached_title',
    message: 'limit.sport_blocked',
  },
  schedule_locked: {
    title: 'schedule.locked_title',
    message: 'schedule.locked_message',
  },
  news_limit_reached: {
    title: 'limit.reached_title',
    message: 'limit.news_reached_message',
  },
  reels_limit_reached: {
    title: 'limit.reached_title',
    message: 'limit.reels_reached_message',
  },
  quiz_limit_reached: {
    title: 'limit.reached_title',
    message: 'limit.quiz_reached_message',
  },
  subscription_limit_reached: {
    title: 'subscription.limit_reached_cta',
    message: 'subscription.limit_reached_news',
  },
  subscription_sport_restricted: {
    title: 'subscription.limit_reached_cta',
    message: 'subscription.limit_reached_sport',
  },
};

export function LimitReached({ type = 'limit_reached', allowedHoursStart, allowedHoursEnd }: LimitReachedProps) {
  const router = useRouter();
  const { locale } = useUser();
  const keys = MESSAGE_KEYS[type];
  const emoji = EMOJIS[type];

  const isSubscriptionType = type === 'subscription_limit_reached' || type === 'subscription_sport_restricted';

  let message = t(keys.message, locale);
  if (type === 'schedule_locked' && allowedHoursStart !== undefined && allowedHoursEnd !== undefined) {
    message = message
      .replace('{start}', String(allowedHoursStart))
      .replace('{end}', String(allowedHoursEnd));
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <span className="text-7xl block mb-6">{emoji}</span>
        <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mb-3">
          {t(keys.title, locale)}
        </h2>
        <p className="text-[var(--color-muted)] mb-8">{message}</p>
        {isSubscriptionType ? (
          <button
            onClick={() => router.push('/upgrade')}
            aria-label={t('subscription.upgrade', locale)}
            className="px-8 py-3 bg-[var(--color-blue)] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {t('subscription.upgrade', locale)}
          </button>
        ) : (
          <button
            onClick={() => router.push('/')}
            aria-label="Go back to home"
            className="px-8 py-3 bg-[var(--color-blue)] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {t('limit.go_home', locale)}
          </button>
        )}
      </div>
    </div>
  );
}
