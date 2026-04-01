import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, t, type Locale } from '@sportykids/shared';
import { KID_FRIENDLY_ERRORS, getErrorType } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';

interface ErrorStateProps {
  error: string | number;
  locale: Locale;
  onRetry?: () => void;
  colors?: ThemeColors;
}

/**
 * Kid-friendly error state for mobile (B-UX7).
 * Shows sports-themed error messages.
 */
export function ErrorState({ error, locale, onRetry, colors }: ErrorStateProps) {
  const errorType = getErrorType(error);
  const errorInfo = KID_FRIENDLY_ERRORS[errorType] ?? KID_FRIENDLY_ERRORS.generic;
  const styles = createStyles(colors);

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.emoji} accessibilityLabel={t('a11y.error.crash_emoji', locale)}>{errorInfo.emoji}</Text>
      <Text style={styles.title} accessibilityRole="header">{t(errorInfo.titleKey, locale)}</Text>
      <Text style={styles.message}>{t(errorInfo.messageKey, locale)}</Text>
      {onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          accessible={true}
          accessibilityLabel={t('a11y.common.retry', locale)}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>{t('kid_errors.retry', locale)}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function createStyles(colors?: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      minHeight: 300,
    },
    emoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors?.text ?? '#1E293B',
      textAlign: 'center',
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      color: colors?.muted ?? '#6B7280',
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
    retryButton: {
      backgroundColor: colors?.blue ?? COLORS.blue,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    retryText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
  });
}
