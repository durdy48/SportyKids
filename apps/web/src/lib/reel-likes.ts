export const LIKES_KEY = 'sportykids_reel_likes';

export function getLikedReels(): Set<string> {
  try {
    const raw = localStorage.getItem(LIKES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function toggleLike(reelId: string): boolean {
  const liked = getLikedReels();
  const isLiked = liked.has(reelId);
  if (isLiked) {
    liked.delete(reelId);
  } else {
    liked.add(reelId);
  }
  localStorage.setItem(LIKES_KEY, JSON.stringify([...liked]));
  return !isLiked;
}
