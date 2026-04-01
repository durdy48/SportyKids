'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

interface PinInputProps {
  onSubmit: (pin: string) => void;
  title: string;
  subtitle?: string;
  buttonText?: string;
  loading?: boolean;
  error?: string | null;
  shake?: boolean;
  lockedUntil?: string | null;
  attemptsRemaining?: number | null;
  locale?: Locale;
}

export function PinInput({ onSubmit, title, subtitle, buttonText, loading, error, shake, lockedUntil, attemptsRemaining, locale = 'es' }: PinInputProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [popIndex, setPopIndex] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const isLocked = countdown > 0;

  const clearInputs = useCallback(() => {
    setDigits(['', '', '', '']);
    refs[0].current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockedUntil) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      return remaining;
    };

    const remaining = updateCountdown();
    if (remaining <= 0) return;

    const interval = setInterval(() => {
      const r = updateCountdown();
      if (r <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [lockedUntil]);

  // Handle external shake trigger
  useEffect(() => {
    if (shake) {
      setShaking(true);
      const timer = setTimeout(() => {
        setShaking(false);
        clearInputs();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [shake, clearInputs]);

  // Handle error-based shake (when error changes to a truthy value)
  useEffect(() => {
    if (error && !isLocked) {
      setShaking(true);
      const timer = setTimeout(() => {
        setShaking(false);
        clearInputs();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [error, clearInputs, isLocked]);

  const handleChange = (index: number, value: string) => {
    if (isLocked) return;
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    if (value) {
      setPopIndex(index);
      setTimeout(() => setPopIndex(null), 200);

      if (index < 3) {
        refs[index + 1].current?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (isLocked) return;
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  };

  const pin = digits.join('');
  const complete = pin.length === 4;

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const lockoutProgress = lockedUntil
    ? Math.max(0, 1 - countdown / 900)
    : 0;

  return (
    <div className="max-w-sm mx-auto text-center py-12 page-enter">
      <span className="text-5xl block mb-4">&#x1F512;</span>
      <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mb-2">
        {title}
      </h2>
      {subtitle && <p className="text-[var(--color-muted)] text-sm mb-8">{subtitle}</p>}

      <div className={`flex justify-center gap-4 mb-6 ${shaking ? 'pin-shake' : ''}`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={isLocked ? '' : d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={isLocked}
            aria-label={t('a11y.parental.pin_digit', locale, { n: String(i + 1), total: '4' })}
            className={`w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-blue)] focus:outline-none transition-colors ${popIndex === i ? 'pin-pop' : ''} ${isLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
          />
        ))}
      </div>

      {isLocked && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
          <p className="text-red-600 dark:text-red-400 font-semibold text-sm mb-2">
            {t('parental.pin_locked_short', locale, { remaining: formatCountdown(countdown) })}
          </p>
          <p className="text-red-500 dark:text-red-300 text-2xl font-mono font-bold mb-3">
            {formatCountdown(countdown)}
          </p>
          <div className="w-full bg-red-200 dark:bg-red-800 rounded-full h-2">
            <div
              className="bg-red-500 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${lockoutProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {!isLocked && error && (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      )}

      {!isLocked && attemptsRemaining !== null && attemptsRemaining !== undefined && attemptsRemaining <= 1 && (
        <p className="text-amber-500 text-xs mb-4">
          {t('parental.pin_lockout_warning', locale)}
        </p>
      )}

      <button
        onClick={() => complete && !isLocked && onSubmit(pin)}
        disabled={!complete || loading || isLocked}
        className="w-full py-3 rounded-xl font-medium bg-[var(--color-blue)] text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
      >
        {loading ? '...' : (buttonText || t('buttons.confirm', locale))}
      </button>
    </div>
  );
}
