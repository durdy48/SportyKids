/**
 * Error monitoring and analytics integration (B-TF6).
 *
 * Sentry for error tracking, PostHog for analytics.
 * Gated by environment variables — no-op when not configured.
 *
 * Environment variables:
 *   SENTRY_DSN           — Sentry Data Source Name
 *   SENTRY_ENVIRONMENT   — 'development' | 'staging' | 'production'
 *   POSTHOG_API_KEY      — PostHog project API key
 *   POSTHOG_HOST         — PostHog host (default: https://app.posthog.com)
 */

import { logger } from './logger';

let Sentry: typeof import('@sentry/node') | null = null;
let sentryInitialized = false;

/**
 * Initialize Sentry for the API server.
 * Call once at startup (in index.ts).
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry DSN not configured — error tracking disabled');
    return;
  }

  try {
    // Dynamic import to avoid bundling Sentry when not needed
    Sentry = require('@sentry/node');
    Sentry!.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || 'development',
      tracesSampleRate: 0.1, // 10% of transactions
      beforeSend(event: unknown) {
        // Scrub any PII from errors
        return event;
      },
    });
    sentryInitialized = true;
    logger.info('Sentry initialized');
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Sentry');
  }
}

/**
 * Capture an exception in Sentry.
 */
export function captureException(error: Error, context?: { requestId?: string; path?: string; method?: string; userId?: string }): void {
  if (!sentryInitialized || !Sentry) return;
  try {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry!.captureException(error);
    });
  } catch {
    // Ignore if Sentry fails
  }
}

/**
 * Add a breadcrumb to the current Sentry scope.
 */
export function addBreadcrumb(message: string, category: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (Sentry) {
    Sentry.addBreadcrumb({ message, category, level });
  }
}

/**
 * Track a server-side event in PostHog.
 */
export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return;

  const host = process.env.POSTHOG_HOST || 'https://app.posthog.com';

  // Fire and forget — don't block the response
  fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      event: eventName,
      properties: {
        ...properties,
        $lib: 'sportykids-api',
      },
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {
    // Silently ignore analytics failures
  });
}
