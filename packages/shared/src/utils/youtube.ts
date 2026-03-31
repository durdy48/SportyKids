/**
 * Child-safe YouTube embed URL builder and utilities.
 *
 * Centralizes all YouTube embed parameters in one place so both web
 * and mobile use the same child-safety settings.
 */

export type YouTubePlatform = 'web' | 'mobile';

/**
 * Base child-safe parameters applied on every platform.
 */
const CHILD_SAFE_PARAMS: Record<string, string> = {
  modestbranding: '1',
  rel: '0',          // No related videos from other channels
  iv_load_policy: '3', // Hide video annotations
  disablekb: '1',    // Disable keyboard shortcuts (child safety)
  playsinline: '1',
};

/**
 * Additional parameters applied only on web.
 */
const WEB_ONLY_PARAMS: Record<string, string> = {
  fs: '0', // Disable fullscreen on web (parent can still use Picture-in-Picture)
};

/**
 * Extract a YouTube video ID from any common URL format.
 *
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - URLs with additional query parameters
 *
 * Returns null if no ID can be extracted.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/,
  );
  return match?.[1] ?? null;
}

/**
 * Build a child-safe YouTube embed URL.
 *
 * @param videoIdOrUrl - YouTube video ID (11 chars) or full URL
 * @param platform     - 'web' or 'mobile' (affects fs param)
 * @param overrides    - Additional params to merge (e.g. autoplay)
 */
export function buildYouTubeEmbedUrl(
  videoIdOrUrl: string,
  platform: YouTubePlatform = 'web',
  overrides: Record<string, string | number> = {},
): string {
  // Heuristic: treat an 11-char alphanumeric string as a bare video ID.
  // This can false-positive on non-ID strings, but the tradeoff is acceptable
  // because callers almost always pass either a full URL or a known video ID.
  const videoId = videoIdOrUrl.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoIdOrUrl)
    ? videoIdOrUrl
    : extractYouTubeVideoId(videoIdOrUrl);

  if (!videoId) {
    // Return the original URL if we can't extract an ID
    return videoIdOrUrl;
  }

  const params: Record<string, string> = {
    ...CHILD_SAFE_PARAMS,
    ...(platform === 'web' ? WEB_ONLY_PARAMS : {}),
  };

  // Apply overrides (convert numbers to strings)
  for (const [key, value] of Object.entries(overrides)) {
    params[key] = String(value);
  }

  const query = new URLSearchParams(params).toString();
  return `https://www.youtube.com/embed/${videoId}?${query}`;
}

/**
 * Get child-safe YouTube IFrame Player API `playerVars` for mobile WebView usage.
 */
export function getYouTubePlayerVars(
  overrides: Record<string, number> = {},
): Record<string, number> {
  const vars: Record<string, number> = {
    modestbranding: 1,
    rel: 0,
    iv_load_policy: 3,
    disablekb: 1,      // Disable keyboard shortcuts (child safety)
    playsinline: 1,
  };

  for (const [key, value] of Object.entries(overrides)) {
    vars[key] = value;
  }

  return vars;
}
