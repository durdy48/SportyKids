import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, KID_FRIENDLY_ERRORS, t, type Locale } from '@sportykids/shared';

interface ErrorBoundaryProps {
  locale?: Locale;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-level error boundary for React Native.
 *
 * Catches unhandled JS errors in the component tree and shows a kid-friendly
 * crash screen using the existing ErrorState pattern. Reports to Sentry if
 * available (dynamic import, no hard dependency).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Report to Sentry if available (dynamic import to avoid hard dep)
    this.reportToSentry(error, info);
  }

  private async reportToSentry(error: Error, info: React.ErrorInfo): Promise<void> {
    try {
      const Sentry = await import('@sentry/react-native');
      if (Sentry?.captureException) {
        Sentry.captureException(error, {
          extra: { componentStack: info.componentStack },
        });
      }
    } catch {
      // Sentry not installed — silently ignore
    }
  }

  private handleRestart = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const locale = this.props.locale ?? 'es';
    const errorInfo = KID_FRIENDLY_ERRORS.crash;
    const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>{errorInfo.emoji}</Text>
        <Text style={styles.title}>{t(errorInfo.titleKey, locale)}</Text>
        <Text style={styles.message}>{t(errorInfo.messageKey, locale)}</Text>

        {isDev && this.state.error && (
          <View style={styles.stackContainer}>
            <Text style={styles.stackTitle}>Stack Trace (dev only):</Text>
            <Text style={styles.stackText} numberOfLines={15}>
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.restartButton} onPress={this.handleRestart}>
          <Text style={styles.restartText}>{t('kid_errors.restart', locale)}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  restartButton: {
    backgroundColor: COLORS.blue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  restartText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  stackContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    maxWidth: '100%',
    maxHeight: 200,
  },
  stackTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 4,
  },
  stackText: {
    fontSize: 10,
    color: '#7F1D1D',
    fontFamily: 'monospace',
  },
});
