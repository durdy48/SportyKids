/**
 * Safely parse a JSON string, returning a fallback value on error.
 */
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
