'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';
import { updateUser, setupParentalPin } from '@/lib/api';
import { PinInput } from '@/components/PinInput';
import Link from 'next/link';

type Screen = 'choose' | 'teen' | 'child' | 'pin-create' | 'pin-confirm';

export default function AgeGatePage() {
  const { user, setUser, locale, loading } = useUser();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('choose');
  const [teenAccepted, setTeenAccepted] = useState(false);
  const [childAccepted, setChildAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if user already completed age gate (in useEffect to avoid setState during render)
  useEffect(() => {
    if (!loading && user && user.ageGateCompleted) {
      router.replace('/');
    }
  }, [loading, user, router]);

  if (loading) return null;
  if (user && user.ageGateCompleted) return null;

  const handleComplete = () => {
    // If user has been through onboarding (has favoriteSports), go home.
    // Otherwise go to onboarding.
    if (user && user.favoriteSports && user.favoriteSports.length > 0) {
      router.replace('/');
    } else {
      router.replace('/onboarding');
    }
  };

  const handleConsentComplete = async () => {
    if (!user) {
      handleComplete();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateUser(user.id, {
        ageGateCompleted: true,
        consentGiven: true,
      });
      setUser(updated);
      handleComplete();
    } catch {
      setError(t('errors.connection_error', locale));
    } finally {
      setSubmitting(false);
    }
  };

  const handleParentPath = () => handleConsentComplete();

  const handleTeenContinue = () => handleConsentComplete();

  const handleChildConsent = () => {
    setScreen('pin-create');
  };

  const handlePinCreate = (pin: string) => {
    setPinValue(pin);
    setPinError(null);
    setScreen('pin-confirm');
  };

  const handlePinConfirm = async (confirmPin: string) => {
    if (confirmPin !== pinValue) {
      setPinError(t('errors.pins_mismatch', locale));
      return;
    }
    setPinError(null);
    setSubmitting(true);
    try {
      if (user) {
        // Create parental profile with PIN
        await setupParentalPin(user.id, pinValue);
        // Update user consent fields
        const updated = await updateUser(user.id, {
          ageGateCompleted: true,
          consentGiven: true,
        });
        setUser(updated);
      }
      handleComplete();
    } catch {
      setPinError(t('errors.create_pin_failed', locale));
    } finally {
      setSubmitting(false);
    }
  };

  // PIN creation screen
  if (screen === 'pin-create') {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
        <header className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <button
            onClick={() => setScreen('child')}
            aria-label="Go back"
            className="text-[var(--color-blue)] hover:underline text-sm font-medium"
          >
            {t('legal.back', locale)}
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <PinInput
            key="pin-create"
            onSubmit={handlePinCreate}
            title={t('onboarding.pin_create', locale)}
            subtitle={t('parental.create_pin_subtitle', locale)}
            buttonText={t('buttons.next', locale)}
            locale={locale}
          />
        </div>
      </div>
    );
  }

  // PIN confirmation screen
  if (screen === 'pin-confirm') {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
        <header className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <button
            onClick={() => { setPinError(null); setScreen('pin-create'); }}
            className="text-[var(--color-blue)] hover:underline text-sm font-medium"
          >
            {t('legal.back', locale)}
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <PinInput
            key="pin-confirm"
            onSubmit={handlePinConfirm}
            title={t('onboarding.pin_confirm', locale)}
            subtitle={t('parental.confirm_pin_subtitle', locale)}
            buttonText={t('buttons.confirm', locale)}
            loading={submitting}
            error={pinError}
            locale={locale}
          />
        </div>
      </div>
    );
  }

  // Teen acceptance screen
  if (screen === 'teen') {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
        <header className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <button
            onClick={() => setScreen('choose')}
            className="text-[var(--color-blue)] hover:underline text-sm font-medium"
          >
            {t('legal.back', locale)}
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center page-enter">
            <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mb-4">
              {t('age_gate.teen_notice_title', locale)}
            </h2>
            <p className="text-[var(--color-muted)] text-sm mb-6 leading-relaxed">
              {t('age_gate.teen_notice_body', locale)}
            </p>

            <div className="mb-4 text-sm text-[var(--color-muted)]">
              <Link href={`/privacy?locale=${locale}`} className="text-[var(--color-blue)] hover:underline">
                {t('legal.privacy_policy', locale)}
              </Link>
              {' · '}
              <Link href={`/terms?locale=${locale}`} className="text-[var(--color-blue)] hover:underline">
                {t('legal.terms_of_service', locale)}
              </Link>
            </div>

            <label className="flex items-start gap-3 text-left mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={teenAccepted}
                onChange={(e) => setTeenAccepted(e.target.checked)}
                aria-label="Accept terms as a teenager"
                className="mt-1 w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-blue)]"
              />
              <span className="text-sm text-[var(--color-text)]">
                {t('age_gate.teen_accept', locale)}
              </span>
            </label>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
            )}

            <button
              onClick={handleTeenContinue}
              disabled={!teenAccepted || submitting}
              className="w-full py-3 rounded-xl font-medium bg-[var(--color-blue)] text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
            >
              {submitting ? t('buttons.loading', locale) : t('age_gate.continue', locale)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Child consent screen
  if (screen === 'child') {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
        <header className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <button
            onClick={() => setScreen('choose')}
            className="text-[var(--color-blue)] hover:underline text-sm font-medium"
          >
            {t('legal.back', locale)}
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full page-enter">
            <div className="text-center mb-6">
              <span className="text-4xl block mb-2">&#x1F512;</span>
              <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mb-1">
                {t('age_gate.child_consent_title', locale)}
              </h2>
              <p className="text-[var(--color-muted)] text-sm">
                {t('age_gate.child_consent_hand_device', locale)}
              </p>
            </div>

            <hr className="border-[var(--color-border)] my-6" />

            <p className="text-sm font-semibold text-[var(--color-text)] mb-3">
              {t('age_gate.child_consent_for_parents', locale)}
            </p>
            <p className="text-sm text-[var(--color-muted)] mb-2">
              {t('age_gate.child_consent_we_collect', locale)}
            </p>
            <ul className="text-sm text-[var(--color-muted)] list-disc pl-5 mb-4 space-y-1">
              <li>{t('age_gate.child_consent_collect_prefs', locale)}</li>
              <li>{t('age_gate.child_consent_collect_activity', locale)}</li>
              <li>{t('age_gate.child_consent_collect_quiz', locale)}</li>
            </ul>

            <p className="text-sm font-semibold text-[var(--color-text)] mb-2">
              {t('age_gate.child_consent_we_dont_collect', locale)}
            </p>
            <ul className="text-sm text-[var(--color-muted)] list-disc pl-5 mb-4 space-y-1">
              <li>{t('age_gate.child_consent_no_location', locale)}</li>
              <li>{t('age_gate.child_consent_no_photos', locale)}</li>
              <li>{t('age_gate.child_consent_no_ads', locale)}</li>
            </ul>

            <div className="mb-4 text-sm text-[var(--color-muted)]">
              <Link href={`/privacy?locale=${locale}`} className="text-[var(--color-blue)] hover:underline">
                {t('legal.privacy_policy', locale)}
              </Link>
              {' · '}
              <Link href={`/terms?locale=${locale}`} className="text-[var(--color-blue)] hover:underline">
                {t('legal.terms_of_service', locale)}
              </Link>
            </div>

            <label className="flex items-start gap-3 text-left mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={childAccepted}
                onChange={(e) => setChildAccepted(e.target.checked)}
                aria-label="Parental consent for child under 13"
                className="mt-1 w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-blue)]"
              />
              <span className="text-sm text-[var(--color-text)]">
                {t('age_gate.child_consent_checkbox', locale)}
              </span>
            </label>

            <button
              onClick={handleChildConsent}
              disabled={!childAccepted}
              className="w-full py-3 rounded-xl font-medium bg-[var(--color-blue)] text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
            >
              {t('age_gate.child_consent_set_pin', locale)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main choose screen
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center page-enter">
        <span className="text-5xl block mb-4">&#9917;</span>
        <h1 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mb-1">
          SportyKids
        </h1>
        <h2 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[var(--color-text)] mb-8">
          {t('age_gate.title', locale)}
        </h2>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        <div className="space-y-3 mb-8">
          <button
            onClick={handleParentPath}
            disabled={submitting}
            aria-label="I am a parent or guardian"
            className="w-full p-4 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-blue)] transition-colors text-left flex items-center gap-3"
            data-testid="age-option-parent"
          >
            <span className="text-2xl">&#x1F468;&#x200D;&#x1F469;&#x200D;&#x1F467;</span>
            <span className="text-sm font-medium text-[var(--color-text)]">
              {t('age_gate.parent_option', locale)}
            </span>
          </button>

          <button
            onClick={() => setScreen('teen')}
            aria-label="I am a teenager, 13 to 17"
            className="w-full p-4 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-blue)] transition-colors text-left flex items-center gap-3"
            data-testid="age-option-teen"
          >
            <span className="text-2xl">&#x1F9D1;</span>
            <span className="text-sm font-medium text-[var(--color-text)]">
              {t('age_gate.teen_option', locale)}
            </span>
          </button>

          <button
            onClick={() => setScreen('child')}
            aria-label="I am under 13"
            className="w-full p-4 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-blue)] transition-colors text-left flex items-center gap-3"
            data-testid="age-option-child"
          >
            <span className="text-2xl">&#x1F467;</span>
            <span className="text-sm font-medium text-[var(--color-text)]">
              {t('age_gate.child_option', locale)}
            </span>
          </button>
        </div>

        <div className="text-sm text-[var(--color-muted)]">
          <Link href={`/privacy?locale=${locale}`} className="hover:underline">
            {t('legal.privacy_policy', locale)}
          </Link>
          {' · '}
          <Link href={`/terms?locale=${locale}`} className="hover:underline">
            {t('legal.terms_of_service', locale)}
          </Link>
        </div>
      </div>
    </div>
  );
}
