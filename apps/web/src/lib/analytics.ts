/**
 * Analytics integration for web (B-TF6).
 *
 * PostHog for product analytics.
 * Gated by NEXT_PUBLIC_POSTHOG_KEY environment variable AND user consent.
 * If consent is not given, all tracking calls are no-ops.
 */

let posthogLoaded = false;
let posthog: { capture: (event: string, properties?: Record<string, unknown>) => void } | null = null;

/**
 * Initialize analytics, gated on user consent.
 * If `consentGiven` is false, PostHog is NOT initialized and all
 * tracking calls remain no-ops. This ensures COPPA/GDPR-K compliance.
 */
export function initAnalytics(consentGiven?: boolean): void {
  // Only initialize if consent is explicitly given
  if (consentGiven !== true) return;

  // Avoid re-initialization
  if (posthogLoaded) return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey || typeof window === 'undefined') return;

  try {
    const ph = require('posthog-js');
    ph.init(apiKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      loaded: (instance: unknown) => {
        posthog = instance as typeof posthog;
        posthogLoaded = true;
      },
      autocapture: false, // Manual tracking only
      capture_pageview: true,
      persistence: 'localStorage',
    });
  } catch {
    // posthog-js not installed
  }
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (!posthogLoaded || !posthog) return;
  posthog.capture(eventName, properties);
}
