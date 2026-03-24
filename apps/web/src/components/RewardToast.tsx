'use client';

import { useEffect, useState } from 'react';

interface RewardToastProps {
  message: string;
  type?: 'achievement' | 'sticker';
  onClose: () => void;
}

export function RewardToast({ message, type = 'achievement', onClose }: RewardToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in
    const showTimer = setTimeout(() => setVisible(true), 50);

    // Auto-dismiss after 4s
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for slide-out animation
    }, 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [onClose]);

  const bgColor = type === 'sticker' ? 'bg-[var(--color-yellow)]' : 'bg-[var(--color-green)]';
  const textColor = type === 'sticker' ? 'text-[var(--color-text)]' : 'text-white';

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] max-w-sm px-5 py-3 rounded-xl shadow-lg transition-all duration-300 ${bgColor} ${textColor} ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{type === 'sticker' ? '🎴' : '🏆'}</span>
        <p className="text-sm font-semibold">{message}</p>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onClose, 300);
          }}
          className="ml-auto text-current opacity-70 hover:opacity-100 text-lg leading-none"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
