'use client';

import { useState, useRef } from 'react';

interface PinInputProps {
  onSubmit: (pin: string) => void;
  title: string;
  subtitle?: string;
  buttonText?: string;
  loading?: boolean;
  error?: string | null;
}

export function PinInput({ onSubmit, title, subtitle, buttonText = 'Confirm', loading, error }: PinInputProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    if (value && index < 3) {
      refs[index + 1].current?.focus();
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
    <div className="max-w-sm mx-auto text-center py-12">
      <span className="text-5xl block mb-4">🔒</span>
      <h2 className="font-[family-name:var(--font-poppins)] text-2xl font-bold text-[var(--color-text)] mb-2">
        {title}
      </h2>
      {subtitle && <p className="text-gray-500 text-sm mb-8">{subtitle}</p>}

      <div className="flex justify-center gap-4 mb-6">
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
            className="w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 border-gray-200 focus:border-[var(--color-blue)] focus:outline-none transition-colors"
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
