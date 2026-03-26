const FAVORITES_KEY = 'sportykids_favorites';
const MAX_FAVORITES = 100;

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function toggleFavorite(newsId: string): boolean {
  const favs = getFavorites();
  const index = favs.indexOf(newsId);
  if (index >= 0) {
    favs.splice(index, 1);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return false; // removed
  }
  favs.unshift(newsId); // newest first
  if (favs.length > MAX_FAVORITES) favs.pop();
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  return true; // added
}

export function isFavorite(newsId: string): boolean {
  return getFavorites().includes(newsId);
}
