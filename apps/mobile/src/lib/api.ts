import type {
  NewsItem,
  Reel,
  QuizQuestion,
  User,
  ParentalProfile,
  RssSource,
  RssSourceCatalogResponse,
  Sticker,
  UserSticker,
  Achievement,
  UserAchievement,
  CheckInResponse,
  TeamStats,
  PushPreferences,
} from '@sportykids/shared';

import { API_BASE } from '../config';

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export interface NewsResponse {
  news: NewsItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface NewsFilters {
  sport?: string;
  team?: string;
  age?: number;
  source?: string;
  userId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export async function fetchNews(filters: NewsFilters = {}): Promise<NewsResponse> {
  const params = new URLSearchParams();
  if (filters.sport) params.set('sport', filters.sport);
  if (filters.team) params.set('team', filters.team);
  if (filters.age) params.set('age', String(filters.age));
  if (filters.source) params.set('source', filters.source);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.q) params.set('q', filters.q);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const res = await fetch(`${API_BASE}/news?${params.toString()}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchNewsSummary(
  newsId: string,
  age: number,
  locale: string,
): Promise<{ summary: string; ageRange: string; generatedAt: string }> {
  const res = await fetch(`${API_BASE}/news/${newsId}/resumen?age=${age}&locale=${locale}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Trending
// ---------------------------------------------------------------------------

export interface TrendingResponse {
  trendingIds: string[];
}

export async function fetchTrending(): Promise<TrendingResponse> {
  try {
    const res = await fetch(`${API_BASE}/news/trending`);
    if (!res.ok) return { trendingIds: [] };
    return res.json();
  } catch {
    return { trendingIds: [] };
  }
}

// ---------------------------------------------------------------------------
// RSS Sources
// ---------------------------------------------------------------------------

export interface RssSourceInfo {
  id: string;
  name: string;
  sport: string;
}

export async function fetchSources(): Promise<RssSourceInfo[]> {
  const res = await fetch(`${API_BASE}/news/fuentes/listado`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchSourceCatalog(): Promise<RssSourceCatalogResponse> {
  const res = await fetch(`${API_BASE}/news/fuentes/catalogo`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function addCustomSource(data: {
  url: string;
  name: string;
  sport: string;
  userId: string;
}): Promise<RssSource> {
  const res = await fetch(`${API_BASE}/news/fuentes/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function deleteCustomSource(sourceId: string, userId?: string): Promise<void> {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const res = await fetch(`${API_BASE}/news/fuentes/custom/${sourceId}${params}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface CreateUserData {
  name: string;
  age: number;
  favoriteSports: string[];
  favoriteTeam?: string;
  selectedFeeds: string[];
}

export async function createUser(data: CreateUserData): Promise<User> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getUser(id: string): Promise<User> {
  const res = await fetch(`${API_BASE}/users/${id}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function updateUser(id: string, data: Partial<CreateUserData>): Promise<User> {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Reels
// ---------------------------------------------------------------------------

export interface ReelsResponse {
  reels: Reel[];
  total: number;
  page: number;
  totalPages: number;
}

export async function fetchReels(
  filters: { sport?: string; page?: number; limit?: number } = {},
): Promise<ReelsResponse> {
  const params = new URLSearchParams();
  if (filters.sport) params.set('sport', filters.sport);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const res = await fetch(`${API_BASE}/reels?${params.toString()}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export async function fetchQuestions(
  count: number = 5,
  sport?: string,
  age?: string,
): Promise<{ questions: QuizQuestion[] }> {
  const params = new URLSearchParams({ count: String(count) });
  if (sport) params.set('sport', sport);
  if (age) params.set('age', age);
  const res = await fetch(`${API_BASE}/quiz/questions?${params.toString()}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function submitAnswer(
  userId: string,
  questionId: string,
  answer: number,
): Promise<{ correct: boolean; correctAnswer: number; pointsEarned: number }> {
  const res = await fetch(`${API_BASE}/quiz/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, questionId, answer }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchScore(
  userId: string,
): Promise<{ name: string; totalPoints: number }> {
  const res = await fetch(`${API_BASE}/quiz/score/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Parental controls (SPANISH routes)
// ---------------------------------------------------------------------------

export async function setupParentalPin(
  userId: string,
  pin: string,
  options?: { allowedFormats?: string[]; maxDailyTimeMinutes?: number },
): Promise<ParentalProfile> {
  const res = await fetch(`${API_BASE}/parents/configurar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin, ...options }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// Parental session token management
let parentalSessionToken: string | null = null;

export function setParentalSessionToken(token: string | null): void {
  parentalSessionToken = token;
}

function parentalHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (parentalSessionToken) {
    headers['X-Parental-Session'] = parentalSessionToken;
  }
  return headers;
}

export async function verifyPin(
  userId: string,
  pin: string,
): Promise<{ verified: boolean; exists: boolean; profile?: ParentalProfile; sessionToken?: string }> {
  const res = await fetch(`${API_BASE}/parents/verificar-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const data = await res.json();
  if (data.sessionToken) {
    parentalSessionToken = data.sessionToken;
  }
  return data;
}

export async function getParentalProfile(
  userId: string,
): Promise<{ exists: boolean; profile?: ParentalProfile }> {
  const res = await fetch(`${API_BASE}/parents/perfil/${userId}`, {
    headers: parentalHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function updateParentalProfile(
  userId: string,
  data: Partial<ParentalProfile>,
): Promise<ParentalProfile> {
  const res = await fetch(`${API_BASE}/parents/perfil/${userId}`, {
    method: 'PUT',
    headers: parentalHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function fetchActivity(
  userId: string,
): Promise<{
  news_viewed: number;
  reels_viewed: number;
  quizzes_played: number;
  totalPoints: number;
}> {
  const res = await fetch(`${API_BASE}/parents/actividad/${userId}`, {
    headers: parentalHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function fetchActivityDetail(
  userId: string,
  from: string,
  to: string,
): Promise<{
  days: {
    date: string;
    news_viewed: number;
    reels_viewed: number;
    quizzes_played: number;
    totalMinutes: number;
  }[];
  mostViewed: string;
}> {
  const res = await fetch(
    `${API_BASE}/parents/actividad/${userId}/detalle?from=${from}&to=${to}`,
    { headers: parentalHeaders() },
  );
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function recordActivity(
  userId: string,
  type: string,
  options?: { durationSeconds?: number; contentId?: string; sport?: string },
): Promise<void> {
  await fetch(`${API_BASE}/parents/actividad/registrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, type, ...options }),
  });
}

// ---------------------------------------------------------------------------
// Gamification
// ---------------------------------------------------------------------------

export async function getStickers(): Promise<{ stickers: Sticker[] }> {
  const res = await fetch(`${API_BASE}/gamification/stickers`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getUserStickers(
  userId: string,
): Promise<{ stickers: UserSticker[]; total: number; collected: number }> {
  const res = await fetch(`${API_BASE}/gamification/stickers/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getAchievements(): Promise<{ achievements: Achievement[] }> {
  const res = await fetch(`${API_BASE}/gamification/achievements`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getUserAchievements(
  userId: string,
): Promise<{ achievements: UserAchievement[]; total: number; unlocked: number }> {
  const res = await fetch(`${API_BASE}/gamification/achievements/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getStreakInfo(
  userId: string,
): Promise<{ currentStreak: number; longestStreak: number; lastActiveDate: string | null }> {
  const res = await fetch(`${API_BASE}/gamification/streaks/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function checkIn(userId: string): Promise<CheckInResponse> {
  const res = await fetch(`${API_BASE}/gamification/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Team stats
// ---------------------------------------------------------------------------

export async function fetchTeamStats(teamName: string): Promise<TeamStats | null> {
  try {
    const res = await fetch(
      `${API_BASE}/teams/${encodeURIComponent(teamName)}/stats`,
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reading history (B-EN4)
// ---------------------------------------------------------------------------

export async function fetchReadingHistory(
  userId: string,
  page = 1,
  limit = 10,
): Promise<{ history: NewsItem[]; total: number }> {
  try {
    const res = await fetch(`${API_BASE}/news/historial?userId=${userId}&page=${page}&limit=${limit}`);
    if (!res.ok) return { history: [], total: 0 };
    return res.json();
  } catch {
    return { history: [], total: 0 };
  }
}

// ---------------------------------------------------------------------------
// Content recommendations (B-CP4)
// ---------------------------------------------------------------------------

export async function fetchRelatedArticles(
  newsId: string,
  limit = 5,
): Promise<{ related: NewsItem[] }> {
  try {
    const res = await fetch(`${API_BASE}/news/${newsId}/relacionados?limit=${limit}`);
    if (!res.ok) return { related: [] };
    return res.json();
  } catch {
    return { related: [] };
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function subscribeNotifications(
  userId: string,
  data: {
    enabled: boolean;
    preferences: PushPreferences;
    pushToken?: string;
    platform?: 'expo' | 'web';
  },
): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/notifications/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

export async function getNotifications(
  userId: string,
): Promise<{ enabled: boolean; preferences: PushPreferences }> {
  const res = await fetch(`${API_BASE}/users/${userId}/notifications`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}
