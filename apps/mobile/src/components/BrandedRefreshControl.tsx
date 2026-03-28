import React from 'react';
import { RefreshControl, Platform } from 'react-native';
import { COLORS, t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';

interface BrandedRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
  locale?: Locale;
}

/**
 * Pull-to-refresh control with SportyKids branding colors (B-MP3).
 * Uses the primary blue with green accent tint.
 */
export function BrandedRefreshControl({ refreshing, onRefresh, locale = 'es' }: BrandedRefreshControlProps) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[COLORS.blue, COLORS.green, COLORS.yellow]} // Android
      tintColor={COLORS.blue} // iOS
      title={refreshing ? t('buttons.loading', locale) : ''}
      titleColor={COLORS.blue}
      progressBackgroundColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
    />
  );
}
