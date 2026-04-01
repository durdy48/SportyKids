/**
 * Sentry beforeSend callback for PII stripping.
 *
 * Mandatory for a kids app (COPPA compliance): strip ALL user data,
 * request headers (may contain auth tokens/cookies), culture context
 * (locale), and server_name before sending events to Sentry.
 */
export function beforeSend(event: Record<string, unknown>): Record<string, unknown> {
  // Strip user identity data
  delete event.user;

  // Strip request data (cookies, headers with tokens)
  delete event.request;

  // Strip server name
  delete event.server_name;

  if (event.contexts) {
    const contexts = event.contexts as Record<string, unknown>;
    // Strip profile data
    delete contexts.profile;
    // Strip culture context (locale, timezone)
    delete contexts.culture;
  }

  return event;
}
