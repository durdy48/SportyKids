/**
 * Schedule check utility — determines if the current time falls within allowed hours.
 *
 * Extracted from parental-guard.ts for reuse in push notification filtering.
 */

/**
 * Get the current hour (0-23) in a given IANA timezone.
 * Falls back to UTC if the timezone is invalid.
 */
export function getCurrentHourInTimezone(timezone: string, now?: Date): number {
  const date = now ?? new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour');
    return hourPart ? parseInt(hourPart.value, 10) : date.getUTCHours();
  } catch {
    return date.getUTCHours();
  }
}

/**
 * Check if the current time falls within the allowed schedule window.
 * Handles ranges that cross midnight (e.g., start=22, end=6).
 */
export function isWithinSchedule(currentHour: number, start: number, end: number): boolean {
  if (start <= end) {
    return currentHour >= start && currentHour < end;
  } else {
    return currentHour >= start || currentHour < end;
  }
}

/**
 * Combined helper: check if now is within allowed hours for a given timezone.
 */
export function isWithinAllowedHours(
  allowedStart: number,
  allowedEnd: number,
  timezone: string,
  now?: Date,
): boolean {
  const currentHour = getCurrentHourInTimezone(timezone, now);
  return isWithinSchedule(currentHour, allowedStart, allowedEnd);
}
