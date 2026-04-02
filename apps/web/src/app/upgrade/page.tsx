'use client';

import { t } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';

interface FeatureRow {
  label: string;
  free: string;
  premium: string;
}

export default function UpgradePage() {
  const { user, locale } = useUser();
  const isPremium = user?.subscriptionTier === 'premium';

  const features: FeatureRow[] = [
    { label: t('subscription.feature_unlimited_news', locale), free: t('subscription.feature_news_limit', locale), premium: t('subscription.feature_unlimited_news', locale) },
    { label: t('subscription.feature_unlimited_quiz', locale), free: t('subscription.feature_quiz_limit', locale), premium: t('subscription.feature_unlimited_quiz', locale) },
    { label: t('subscription.feature_unlimited_reels', locale), free: t('subscription.feature_reels_limit', locale), premium: t('subscription.feature_unlimited_reels', locale) },
    { label: t('subscription.feature_all_sports', locale), free: t('subscription.feature_one_sport', locale), premium: t('subscription.feature_all_sports', locale) },
    { label: t('subscription.feature_digest', locale), free: t('subscription.feature_no_digest', locale), premium: t('subscription.feature_digest', locale) },
  ];

  if (isPremium) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <span className="text-7xl block mb-6">🏆</span>
          <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-bold text-[var(--color-text)] mb-4">
            {t('subscription.premium', locale)}
          </h1>
          <p className="text-[var(--color-muted)] mb-6">
            {user?.subscriptionExpiry
              ? t('subscription.active_until', locale, { date: new Date(user.subscriptionExpiry).toLocaleDateString() })
              : t('subscription.premium_tier_label', locale)}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <span className="text-7xl block mb-4">🏆</span>
          <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-bold text-[var(--color-text)] mb-2">
            {t('subscription.upgrade', locale)}
          </h1>
          <p className="text-[var(--color-muted)]">
            {t('subscription.features_title', locale)}
          </p>
        </div>

        {/* Feature comparison table */}
        <div className="border border-[var(--color-border)] rounded-xl overflow-hidden mb-8">
          <div className="grid grid-cols-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] p-3">
            <div />
            <div className="text-center text-sm font-semibold text-[var(--color-muted)]">{t('subscription.free', locale)}</div>
            <div className="text-center text-sm font-semibold text-[var(--color-blue)]">{t('subscription.premium', locale)}</div>
          </div>
          {features.map((f, i) => (
            <div key={i} className="grid grid-cols-3 p-3 border-b border-[var(--color-border)] last:border-b-0">
              <div className="text-sm text-[var(--color-text)]">{f.label}</div>
              <div className="text-center text-sm text-[var(--color-muted)]">{f.free}</div>
              <div className="text-center text-sm text-[var(--color-green)] font-medium">{f.premium}</div>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="text-center space-y-3 mb-8">
          <div className="px-6 py-4 border border-[var(--color-border)] rounded-xl">
            <span className="font-semibold text-[var(--color-text)]">{t('subscription.monthly', locale)}</span>
            <span className="text-[var(--color-muted)] ml-2">{t('subscription.monthly_price', locale)}</span>
          </div>
          <div className="px-6 py-4 border-2 border-[var(--color-blue)] rounded-xl bg-blue-50 dark:bg-blue-950/20">
            <span className="font-semibold text-[var(--color-text)]">{t('subscription.yearly', locale)}</span>
            <span className="text-[var(--color-muted)] ml-2">{t('subscription.yearly_price', locale)}</span>
            <span className="ml-2 text-[var(--color-green)] font-medium text-sm">({t('subscription.yearly_savings', locale)})</span>
          </div>
        </div>

        <p className="text-center text-sm text-[var(--color-muted)] mb-6">
          {t('subscription.family_plan', locale)}
        </p>

        {/* Download prompt */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 text-center">
          <p className="text-[var(--color-text)] font-medium mb-4">
            {t('subscription.web_desktop_prompt', locale)}
          </p>
          <div className="flex justify-center gap-4">
            <a
              href={process.env.NEXT_PUBLIC_APP_STORE_URL ?? 'https://apps.apple.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              aria-label="App Store"
            >
              App Store
            </a>
            <a
              href={process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? 'https://play.google.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[var(--color-green)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              aria-label="Google Play"
            >
              Google Play
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
