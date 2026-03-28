/** HTML-encode a string to prevent injection in WebView HTML. */
export function htmlEncode(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Extract a YouTube video ID from any YouTube URL format. */
export function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=))([^?&]+)/);
  return match?.[1] ?? null;
}

/** Extract a YouTube thumbnail URL from a YouTube URL. */
export function getYouTubeThumbnail(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  return null;
}

/** Extract a watchable YouTube URL from any YouTube URL format. */
export function getYouTubeWatchUrl(url: string): string {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
}
