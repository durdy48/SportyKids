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
  auth_required: {
    titleKey: 'kid_errors.auth_required_title',
    messageKey: 'kid_errors.auth_required_message',
    emoji: '\u{1F512}', // lock
  },
  too_fast: {
    titleKey: 'kid_errors.too_fast_title',
    messageKey: 'kid_errors.too_fast_message',
    emoji: '\u{1F3C3}', // runner
  },
  forbidden: {
    titleKey: 'kid_errors.forbidden_title',
    messageKey: 'kid_errors.forbidden_message',
    emoji: '\u{1F6AB}', // no entry
  },
  rate_limited: {
    titleKey: 'kid_errors.rate_limited_title',
    messageKey: 'kid_errors.rate_limited_message',
    emoji: '\u{1F6A6}', // traffic light
  },
  format_blocked: {
    titleKey: 'kid_errors.format_blocked_title',
    messageKey: 'kid_errors.format_blocked_message',
    emoji: '\u{1F6A7}', // construction sign
  },
  limit_reached: {
    titleKey: 'kid_errors.limit_reached_title',
    messageKey: 'kid_errors.limit_reached_message',
    emoji: '\u{23F0}', // alarm clock
  },
  unauthorized: {
    titleKey: 'kid_errors.unauthorized_title',
    messageKey: 'kid_errors.unauthorized_message',
    emoji: '\u{1F510}', // closed lock with key
  },
  generic: {
    titleKey: 'kid_errors.generic_title',
    messageKey: 'kid_errors.generic_message',
    emoji: '\u{26BD}', // soccer ball
  },
} as const;

/**
 * Typed error codes shared between API and clients.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SCHEDULE_LOCKED: 'SCHEDULE_LOCKED',
  TIME_LIMIT_EXCEEDED: 'TIME_LIMIT_EXCEEDED',
  FORMAT_RESTRICTED: 'FORMAT_RESTRICTED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Determine error type from an HTTP status or error message.
 */
export function getErrorType(statusOrMessage: number | string): keyof typeof KID_FRIENDLY_ERRORS {
  if (typeof statusOrMessage === 'number') {
    if (statusOrMessage === 401) return 'unauthorized';
    if (statusOrMessage === 403) return 'forbidden';
    if (statusOrMessage === 404) return 'not_found';
    if (statusOrMessage === 408) return 'timeout';
    if (statusOrMessage === 429) return 'rate_limited';
    if (statusOrMessage >= 500) return 'server';
    return 'generic';
  }
  const msg = statusOrMessage.toLowerCase();
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) return 'network';
  if (msg.includes('timeout') || msg.includes('aborted')) return 'timeout';
  if (msg.includes('offline')) return 'offline';
  if (msg.includes('not found') || msg === '404' || msg.startsWith('404 ') || msg.startsWith('404:')) return 'not_found';
  if (msg.includes('schedule_locked') || msg.includes('schedule locked')) return 'schedule_locked';
  if (msg.includes('format_blocked') || msg.includes('format restricted')) return 'format_blocked';
  if (msg.includes('limit_reached') || msg.includes('time_limit') || msg.includes('time limit')) return 'limit_reached';
  if (msg.includes('rate') || msg === '429' || msg.startsWith('429 ') || msg.startsWith('429:') || msg.includes('too many') || msg.includes('too fast')) return 'rate_limited';
  if (msg.includes('unauthorized') || msg === '401' || msg.startsWith('401 ') || msg.startsWith('401:')) return 'unauthorized';
  if (msg.includes('auth') || msg.includes('login')) return 'auth_required';
  if (msg.includes('forbidden') || msg === '403' || msg.startsWith('403 ') || msg.startsWith('403:')) return 'forbidden';
  return 'generic';
}
