import React from 'react';
import { RefreshControl, Platform } from 'react-native';
import { COLORS } from '@sportykids/shared';

interface BrandedRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * Pull-to-refresh control with SportyKids branding colors (B-MP3).
 * Uses the primary blue with green accent tint.
 */
export function BrandedRefreshControl({ refreshing, onRefresh }: BrandedRefreshControlProps) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[COLORS.blue, COLORS.green, COLORS.yellow]} // Android
      tintColor={COLORS.blue} // iOS
      title={refreshing ? 'Refreshing...' : ''}
      titleColor={COLORS.blue}
      progressBackgroundColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
    />
  );
}
