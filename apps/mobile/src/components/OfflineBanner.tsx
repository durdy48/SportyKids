import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { t, type Locale } from '@sportykids/shared';

interface OfflineBannerProps {
  locale: Locale;
}

/**
 * Offline indicator banner for mobile (B-MP4).
 * Listens to NetInfo when available, falls back to always online.
 */
export function OfflineBanner({ locale }: OfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    try {
      // Dynamic import to handle case where @react-native-community/netinfo isn't installed
      const NetInfo = require('@react-native-community/netinfo').default;
      unsubscribe = NetInfo.addEventListener((state: { isConnected: boolean | null }) => {
        setIsOffline(state.isConnected === false);
      });
    } catch {
      // NetInfo not available — assume online
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLabel={t('a11y.common.offline_banner', locale)}>
      <Text style={styles.text}>{t('offline.banner', locale)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
