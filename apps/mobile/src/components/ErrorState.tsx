import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, t } from '@sportykids/shared';
import { KID_FRIENDLY_ERRORS, getErrorType } from '@sportykids/shared';

interface ErrorStateProps {
  error: string | number;
  locale: string;
  onRetry?: () => void;
}

/**
 * Kid-friendly error state for mobile (B-UX7).
 * Shows sports-themed error messages.
 */
export function ErrorState({ error, locale, onRetry }: ErrorStateProps) {
  const errorType = getErrorType(error);
  const errorInfo = KID_FRIENDLY_ERRORS[errorType] ?? KID_FRIENDLY_ERRORS.generic;

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{errorInfo.emoji}</Text>
      <Text style={styles.title}>{t(errorInfo.titleKey, locale)}</Text>
      <Text style={styles.message}>{t(errorInfo.messageKey, locale)}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>{t('kid_errors.retry', locale)}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: COLORS.darkText,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: COLORS.blue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
});
