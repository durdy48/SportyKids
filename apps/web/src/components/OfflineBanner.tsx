'use client';

import { useState, useEffect } from 'react';
import { t } from '@sportykids/shared';
import { useUser } from '@/lib/user-context';

export function OfflineBanner() {
  const { locale } = useUser();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium">
      {t('offline.banner', locale)}
    </div>
  );
}
