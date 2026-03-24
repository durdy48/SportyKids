'use client';

import { useRouter } from 'next/navigation';
import { t } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';

type LimitType = 'limit_reached' | 'format_blocked' | 'sport_blocked';

interface LimitReachedProps {
  type?: LimitType;
}

const EMOJIS: Record<LimitType, string> = {
  limit_reached: '\u{1F634}',
  format_blocked: '\u{1F6AB}',
  sport_blocked: '\u{26BD}',
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
};

export function LimitReached({ type = 'limit_reached' }: LimitReachedProps) {
  const router = useRouter();
  const { locale } = useUser();
  const keys = MESSAGE_KEYS[type];
  const emoji = EMOJIS[type];

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <span className="text-7xl block mb-6">{emoji}</span>
        <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mb-3">
          {t(keys.title, locale)}
        </h2>
        <p className="text-gray-500 mb-8">{t(keys.message, locale)}</p>
        <button
          onClick={() => router.push('/')}
          className="px-8 py-3 bg-[var(--color-blue)] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          {t('limit.go_home', locale)}
        </button>
      </div>
    </div>
  );
}
