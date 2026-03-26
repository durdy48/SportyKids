'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface PinInputProps {
  onSubmit: (pin: string) => void;
  title: string;
  subtitle?: string;
  buttonText?: string;
  loading?: boolean;
  error?: string | null;
  shake?: boolean;
}

export function PinInput({ onSubmit, title, subtitle, buttonText = 'Confirm', loading, error, shake }: PinInputProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [popIndex, setPopIndex] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const clearInputs = useCallback(() => {
    setDigits(['', '', '', '']);
    refs[0].current?.focus();
  }, []);

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
    if (error) {
      setShaking(true);
      const timer = setTimeout(() => {
        setShaking(false);
        clearInputs();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [error, clearInputs]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    if (value) {
      // Trigger pop animation on this digit
      setPopIndex(index);
      setTimeout(() => setPopIndex(null), 200);

      if (index < 3) {
        refs[index + 1].current?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  };

  const pin = digits.join('');
  const complete = pin.length === 4;

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
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-blue)] focus:outline-none transition-colors ${popIndex === i ? 'pin-pop' : ''}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      )}

      <button
        onClick={() => complete && onSubmit(pin)}
        disabled={!complete || loading}
        className="w-full py-3 rounded-xl font-medium bg-[var(--color-blue)] text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
      >
        {loading ? '...' : buttonText}
      </button>
    </div>
  );
}
