'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ParentalProfile } from '@sportykids/shared';
import { t } from '@sportykids/shared';
import { verifyPin, setupParentalPin, getParentalProfile } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { PinInput } from '@/components/PinInput';
import { ParentalPanel } from '@/components/ParentalPanel';
import { ParentalTour } from '@/components/ParentalTour';

type State = 'loading' | 'create-pin' | 'confirm-pin' | 'verify-pin' | 'panel';

export default function ParentsPage() {
  const { user, loading: userLoading, setParentalProfile, locale } = useUser();
  const router = useRouter();

  const [state, setState] = useState<State>('loading');
  const [profile, setProfile] = useState<ParentalProfile | null>(null);
  const [tempPin, setTempPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace('/onboarding');
      return;
    }
    if (user) {
      getParentalProfile(user.id).then((r) => {
        if (r.exists) {
          setState('verify-pin');
        } else {
          setState('create-pin');
        }
      });
    }
  }, [userLoading, user, router]);

  const handleCreatePin = (pin: string) => {
    setTempPin(pin);
    setState('confirm-pin');
    setError(null);
  };

  const handleConfirmPin = async (pin: string) => {
    if (pin !== tempPin) {
      setError(t('errors.pins_mismatch', locale));
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const created = await setupParentalPin(user.id, pin);
      setProfile(created);
      setParentalProfile(created);
      setState('panel');
    } catch {
      setError(t('errors.create_pin_failed', locale));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async (pin: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const result = await verifyPin(user.id, pin);
      if (result.verified && result.profile) {
        setProfile(result.profile);
        setParentalProfile(result.profile);
        setState('panel');
      } else {
        setError(t('errors.incorrect_pin', locale));
      }
    } catch {
      setError(t('errors.connection_error', locale));
    } finally {
      setLoading(false);
    }
  };

  if (userLoading || !user || state === 'loading') return null;

  return (
    <div className="page-enter">
      {state === 'create-pin' && (
        <PinInput
          title={t('parental.create_pin', locale)}
          subtitle={t('parental.create_pin_subtitle', locale)}
          buttonText={t('buttons.next', locale)}
          onSubmit={handleCreatePin}
        />
      )}

      {state === 'confirm-pin' && (
        <PinInput
          title={t('parental.confirm_pin', locale)}
          subtitle={t('parental.confirm_pin_subtitle', locale)}
          buttonText={t('buttons.create_pin', locale)}
          onSubmit={handleConfirmPin}
          loading={loading}
          error={error}
        />
      )}

      {state === 'verify-pin' && (
        <PinInput
          title={t('parental.control', locale)}
          subtitle={t('parental.enter_pin', locale)}
          buttonText={t('buttons.access', locale)}
          onSubmit={handleVerifyPin}
          loading={loading}
          error={error}
        />
      )}

      {state === 'panel' && profile && (
        <>
          <ParentalTour />
          <ParentalPanel profile={profile} />
        </>
      )}
    </div>
  );
}
