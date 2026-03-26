import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'sportykids_favorites';
const MAX_FAVORITES = 100;

let cachedFavorites: string[] | null = null;

export async function getFavorites(): Promise<string[]> {
  if (cachedFavorites !== null) return cachedFavorites;
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    cachedFavorites = raw ? JSON.parse(raw) : [];
    return cachedFavorites!;
  } catch {
    cachedFavorites = [];
    return [];
  }
}

export async function toggleFavorite(newsId: string): Promise<boolean> {
  const favs = await getFavorites();
  const index = favs.indexOf(newsId);
  if (index >= 0) {
    favs.splice(index, 1);
    cachedFavorites = [...favs];
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return false; // removed
  }
  favs.unshift(newsId); // newest first
  if (favs.length > MAX_FAVORITES) favs.pop();
  cachedFavorites = [...favs];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  return true; // added
}

export async function isFavorite(newsId: string): Promise<boolean> {
  const favs = await getFavorites();
  return favs.includes(newsId);
}
