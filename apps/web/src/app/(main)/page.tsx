'use client';

import { t } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';
import { HomeFeedClient } from './HomeFeedClient';

export default function Home() {
  const { locale } = useUser();

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)]">
          {t('home.latest_news', locale)}
        </h2>
        <p className="text-[var(--color-muted)] text-sm mt-1">
          {t('home.subtitle', locale)}
        </p>
      </div>
      <HomeFeedClient />
    </div>
  );
}
