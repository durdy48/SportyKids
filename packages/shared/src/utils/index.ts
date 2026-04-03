const SPORT_COLORS: Record<string, string> = {
  football: '#22C55E',
  basketball: '#F97316',
  tennis: '#FACC15',
  swimming: '#3B82F6',
  athletics: '#EF4444',
  cycling: '#A855F7',
  formula1: '#DC2626',
  padel: '#14B8A6',
};

const SPORT_EMOJIS: Record<string, string> = {
  football: '⚽',
  basketball: '🏀',
  tennis: '🎾',
  swimming: '🏊',
  athletics: '🏃',
  cycling: '🚴',
  formula1: '🏎️',
  padel: '🏓',
};

export function sportToColor(sport: string): string {
  return SPORT_COLORS[sport] ?? '#6B7280';
}

export function sportToEmoji(sport: string): string {
  return SPORT_EMOJIS[sport] ?? '🏅';
}

export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars).replace(/\s+\S*$/, '') + '...';
}

export { extractYouTubeVideoId, buildYouTubeEmbedUrl, getYouTubePlayerVars } from './youtube';
export type { YouTubePlatform } from './youtube';

export { getSourceIdsForEntities } from './entities';
export type { FeedSource } from './entities';

export function formatDate(date: Date | string, locale: string = 'es'): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (locale === 'en') {
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  }

  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
