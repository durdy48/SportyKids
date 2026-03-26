/**
 * Kid-friendly error message keys (B-UX7).
 *
 * Each error type maps to i18n keys for title and message.
 * The UI should look up these keys to show sports-themed, friendly messages.
 */

export interface KidFriendlyError {
  titleKey: string;
  messageKey: string;
  emoji: string;
}

export const KID_FRIENDLY_ERRORS: Record<string, KidFriendlyError> = {
  network: {
    titleKey: 'kid_errors.network_title',
    messageKey: 'kid_errors.network_message',
    emoji: '\u{1F3C8}', // football
  },
  not_found: {
    titleKey: 'kid_errors.not_found_title',
    messageKey: 'kid_errors.not_found_message',
    emoji: '\u{1F50D}', // magnifying glass
  },
  server: {
    titleKey: 'kid_errors.server_title',
    messageKey: 'kid_errors.server_message',
    emoji: '\u{1F3D7}\uFE0F', // construction
  },
  timeout: {
    titleKey: 'kid_errors.timeout_title',
    messageKey: 'kid_errors.timeout_message',
    emoji: '\u{23F1}\uFE0F', // stopwatch
  },
  empty: {
    titleKey: 'kid_errors.empty_title',
    messageKey: 'kid_errors.empty_message',
    emoji: '\u{1F3AF}', // target
  },
  offline: {
    titleKey: 'kid_errors.offline_title',
    messageKey: 'kid_errors.offline_message',
    emoji: '\u{1F4F6}', // signal bars
  },
  schedule_locked: {
    titleKey: 'kid_errors.schedule_locked_title',
    messageKey: 'kid_errors.schedule_locked_message',
    emoji: '\u{1F319}', // crescent moon
  },
  generic: {
    titleKey: 'kid_errors.generic_title',
    messageKey: 'kid_errors.generic_message',
    emoji: '\u{26BD}', // soccer ball
  },
} as const;

/**
 * Determine error type from an HTTP status or error message.
 */
export function getErrorType(statusOrMessage: number | string): keyof typeof KID_FRIENDLY_ERRORS {
  if (typeof statusOrMessage === 'number') {
    if (statusOrMessage === 404) return 'not_found';
    if (statusOrMessage === 408) return 'timeout';
    if (statusOrMessage >= 500) return 'server';
    return 'generic';
  }
  const msg = statusOrMessage.toLowerCase();
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) return 'network';
  if (msg.includes('timeout') || msg.includes('aborted')) return 'timeout';
  if (msg.includes('offline')) return 'offline';
  if (msg.includes('not found') || msg.includes('404')) return 'not_found';
  return 'generic';
}
