/**
 * Feed ranker — sorts news items by user preference relevance.
 *
 * Scoring:
 *   +5  favorite team match
 *   +3  favorite sport match
 *    0  unfollowed sport → filtered out entirely
 *
 * Within the same score tier, items are sorted by publishedAt DESC.
 */

interface RankableItem {
  sport: string;
  team?: string | null;
  publishedAt: Date | string;
  [key: string]: unknown;
}

interface UserPrefs {
  favoriteSports: string[];
  favoriteTeam?: string | null;
}

export function rankFeed<T extends RankableItem>(
  news: T[],
  userPrefs: UserPrefs,
): T[] {
  const { favoriteSports, favoriteTeam } = userPrefs;

  // If user has no sport preferences, return all sorted by date
  if (!favoriteSports || favoriteSports.length === 0) {
    return sortByDate(news);
  }

  const sportSet = new Set(favoriteSports.map((s) => s.toLowerCase()));
  const teamLower = favoriteTeam?.toLowerCase() ?? null;

  // Filter out sports the user does not follow
  const filtered = news.filter((item) => sportSet.has(item.sport.toLowerCase()));

  // Score each item
  const scored = filtered.map((item) => {
    let score = 0;

    // Favorite team match
    if (
      teamLower &&
      item.team &&
      item.team.toLowerCase().includes(teamLower)
    ) {
      score += 5;
    }

    // Favorite sport (always true after filtering, but explicit for clarity)
    if (sportSet.has(item.sport.toLowerCase())) {
      score += 3;
    }

    return { item, score };
  });

  // Sort: highest score first, then by publishedAt DESC within same score
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return toTime(b.item.publishedAt) - toTime(a.item.publishedAt);
  });

  return scored.map((s) => s.item);
}

function toTime(date: Date | string): number {
  return date instanceof Date ? date.getTime() : new Date(date).getTime();
}

function sortByDate<T extends RankableItem>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => toTime(b.publishedAt) - toTime(a.publishedAt),
  );
}
