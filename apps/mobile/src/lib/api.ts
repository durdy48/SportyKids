import type {
  NewsItem,
  Reel,
  QuizQuestion,
  User,
  LiveMatchData,
  LiveScorePreferences,
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
  Organization,
  OrganizationMember,
  OrganizationActivity,
  JoinOrganizationResponse,
} from '@sportykids/shared';

import { API_BASE } from '../config';
import { getAccessToken, refreshToken } from './auth';

// ---------------------------------------------------------------------------
// Authenticated fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Fetch wrapper that attaches the JWT Authorization header.
 * On 401, attempts a single token refresh and retries the request.
 */
async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(url, { ...init, headers });

  // If 401 and we had a token, try refreshing once
  if (res.status === 401 && token) {
    const newToken = await refreshToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...init, headers });
    }
  }

  return res;
}

// ---------------------------------------------------------------------------
// 403 error parser (shared by all content endpoints)
// ---------------------------------------------------------------------------

interface Blocked403 extends Error {
  scheduleLocked?: boolean;
  allowedHoursStart?: number;
  allowedHoursEnd?: number;
  subscriptionError?: boolean;
  limitType?: string;
  limit?: number;
  used?: number;
  tier?: string;
  allowedSports?: string[];
  formatBlocked?: boolean;
}

async function parse403(res: Response): Promise<Blocked403 | null> {
  try {
    const body = await res.json();
    const details = body?.error?.details ?? body?.error ?? {};
    const errorType = details.error ?? '';

    if (errorType === 'schedule_locked') {
      const err = new Error('schedule_locked') as Blocked403;
      err.scheduleLocked = true;
      err.allowedHoursStart = details.allowedHoursStart ?? 0;
      err.allowedHoursEnd = details.allowedHoursEnd ?? 24;
      return err;
    }

    if (errorType === 'subscription_limit_reached' || errorType === 'subscription_sport_restricted') {
      const err = new Error(errorType) as Blocked403;
      err.subscriptionError = true;
      err.limitType = details.limitType;
      err.limit = details.limit;
      err.used = details.used;
      err.tier = details.tier;
      err.allowedSports = details.allowedSports;
      return err;
    }

    if (errorType === 'format_blocked' || errorType === 'limit_reached') {
      const err = new Error(errorType) as Blocked403;
      err.formatBlocked = true;
      return err;
    }

    if (errorType === 'sport_blocked') {
      const err = new Error(errorType) as Blocked403;
      err.subscriptionError = true;
      err.limitType = 'sport';
      return err;
    }
  } catch {
    // Body not parseable — fall through
  }
  return null;
}

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
  locale?: string;
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
  if (filters.locale) params.set('locale', filters.locale);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const res = await authFetch(`${API_BASE}/news?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 403) {
      const parsed = await parse403(res);
      if (parsed) throw parsed;
    }
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchNewsSummary(
  newsId: string,
  age: number,
  locale: string,
): Promise<{ summary: string; ageRange: string; generatedAt: string }> {
  const res = await authFetch(`${API_BASE}/news/${newsId}/summary?age=${age}&locale=${locale}`);
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
    const res = await authFetch(`${API_BASE}/news/trending`);
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
  const res = await authFetch(`${API_BASE}/news/sources/list`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchSourceCatalog(): Promise<RssSourceCatalogResponse> {
  const res = await authFetch(`${API_BASE}/news/sources/catalog`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function addCustomSource(data: {
  url: string;
  name: string;
  sport: string;
  userId: string;
}): Promise<RssSource> {
  const res = await authFetch(`${API_BASE}/news/sources/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function deleteCustomSource(sourceId: string, userId?: string): Promise<void> {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const res = await authFetch(`${API_BASE}/news/sources/custom/${sourceId}${params}`, {
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
  locale?: string;
  country?: string;
  ageGateCompleted?: boolean;
  consentGiven?: boolean;
}

export async function createUser(data: CreateUserData): Promise<User> {
  const res = await authFetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getUser(id: string): Promise<User> {
  const res = await authFetch(`${API_BASE}/users/${id}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function updateUser(id: string, data: Partial<CreateUserData>): Promise<User> {
  const res = await authFetch(`${API_BASE}/users/${id}`, {
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
  filters: { sport?: string; page?: number; limit?: number; userId?: string } = {},
): Promise<ReelsResponse> {
  const params = new URLSearchParams();
  if (filters.sport) params.set('sport', filters.sport);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.userId) params.set('userId', filters.userId);
  const res = await authFetch(`${API_BASE}/reels?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 403) {
      const parsed = await parse403(res);
      if (parsed) throw parsed;
    }
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export async function fetchQuestions(
  count: number = 5,
  sport?: string,
  age?: string,
  userId?: string,
): Promise<{ questions: QuizQuestion[] }> {
  const params = new URLSearchParams({ count: String(count) });
  if (sport) params.set('sport', sport);
  if (age) params.set('age', age);
  if (userId) params.set('userId', userId);
  const res = await authFetch(`${API_BASE}/quiz/questions?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 403) {
      const parsed = await parse403(res);
      if (parsed) throw parsed;
    }
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function submitAnswer(
  userId: string,
  questionId: string,
  answer: number,
): Promise<{ correct: boolean; correctAnswer: number; pointsEarned: number }> {
  const res = await authFetch(`${API_BASE}/quiz/answer`, {
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
  const res = await authFetch(`${API_BASE}/quiz/score/${userId}`);
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
  const res = await authFetch(`${API_BASE}/parents/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin, ...options }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// Parental session token management
let parentalSessionToken: string | null = null;

export function getParentalSessionToken(): string | null {
  return parentalSessionToken;
}

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

export interface PinVerifyResult {
  verified: boolean;
  exists?: boolean;
  profile?: ParentalProfile;
  sessionToken?: string;
  attemptsRemaining?: number;
  lockedUntil?: string;
  remainingSeconds?: number;
  error?: string;
  status?: number;
}

export async function verifyPin(
  userId: string,
  pin: string,
): Promise<PinVerifyResult> {
  const res = await authFetch(`${API_BASE}/parents/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin }),
  });
  const data = await res.json();

  if (res.status === 429) {
    return { verified: false, status: 429, error: data.error };
  }
  if (res.status === 423) {
    return { verified: false, status: 423, error: data.error, lockedUntil: data.lockedUntil, remainingSeconds: data.remainingSeconds };
  }
  if (res.status === 401) {
    return { verified: false, status: 401, error: data.error, attemptsRemaining: data.attemptsRemaining };
  }
  if (!res.ok) throw new Error(`Error ${res.status}`);

  if (data.sessionToken) {
    parentalSessionToken = data.sessionToken;
  }
  return data;
}

export async function getParentalProfile(
  userId: string,
): Promise<{ exists: boolean; profile?: ParentalProfile }> {
  const res = await authFetch(`${API_BASE}/parents/profile/${userId}`, {
    headers: parentalHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function updateParentalProfile(
  userId: string,
  data: Partial<ParentalProfile>,
): Promise<ParentalProfile> {
  const res = await authFetch(`${API_BASE}/parents/profile/${userId}`, {
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
  const res = await authFetch(`${API_BASE}/parents/activity/${userId}`, {
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
  const res = await authFetch(
    `${API_BASE}/parents/activity/${userId}/detail?from=${from}&to=${to}`,
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
  await authFetch(`${API_BASE}/parents/activity/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, type, ...options }),
  });
}

// ---------------------------------------------------------------------------
// Gamification
// ---------------------------------------------------------------------------

export async function getStickers(): Promise<{ stickers: Sticker[] }> {
  const res = await authFetch(`${API_BASE}/gamification/stickers`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getUserStickers(
  userId: string,
): Promise<{ stickers: UserSticker[]; total: number; collected: number }> {
  const res = await authFetch(`${API_BASE}/gamification/stickers/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getAchievements(): Promise<{ achievements: Achievement[] }> {
  const res = await authFetch(`${API_BASE}/gamification/achievements`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getUserAchievements(
  userId: string,
): Promise<{ achievements: UserAchievement[]; total: number; unlocked: number }> {
  const res = await authFetch(`${API_BASE}/gamification/achievements/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getStreakInfo(
  userId: string,
): Promise<{ currentStreak: number; longestStreak: number; lastActiveDate: string | null }> {
  const res = await authFetch(`${API_BASE}/gamification/streaks/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function checkIn(userId: string): Promise<CheckInResponse> {
  const res = await authFetch(`${API_BASE}/gamification/check-in`, {
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
    const res = await authFetch(
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
    const res = await authFetch(`${API_BASE}/news/history?userId=${userId}&page=${page}&limit=${limit}`);
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
    const res = await authFetch(`${API_BASE}/news/${newsId}/related?limit=${limit}`);
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
  const res = await authFetch(`${API_BASE}/users/${userId}/notifications/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

// ---------------------------------------------------------------------------
// Digest (Parental)
// ---------------------------------------------------------------------------

export async function getDigestPreferences(userId: string): Promise<{
  digestEnabled: boolean;
  digestEmail: string | null;
  digestDay: number;
}> {
  const res = await authFetch(`${API_BASE}/parents/digest/${userId}`, {
    headers: parentalHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function updateDigestPreferences(
  userId: string,
  data: { digestEnabled?: boolean; digestEmail?: string | null; digestDay?: number },
): Promise<unknown> {
  const res = await authFetch(`${API_BASE}/parents/digest/${userId}`, {
    method: 'PUT',
    headers: parentalHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

export async function fetchTodayMission(userId: string): Promise<{ mission: Record<string, unknown> | null; expired?: boolean }> {
  const res = await authFetch(`${API_BASE}/missions/today/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function claimMission(userId: string): Promise<{ claimed: boolean; sticker: unknown; pointsAwarded: number }> {
  const res = await authFetch(`${API_BASE}/missions/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Feed Preview (parental)
// ---------------------------------------------------------------------------

export async function fetchFeedPreview(userId: string): Promise<{ news: NewsItem[]; reels: Reel[]; quizAvailable: boolean }> {
  const res = await authFetch(`${API_BASE}/parents/preview/${userId}`, {
    headers: parentalHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getNotifications(
  userId: string,
): Promise<{ enabled: boolean; preferences: PushPreferences }> {
  const res = await authFetch(`${API_BASE}/users/${userId}/notifications`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Live scores
// ---------------------------------------------------------------------------

export async function getLiveMatch(teamName: string): Promise<LiveMatchData | null> {
  try {
    const res = await authFetch(`${API_BASE}/teams/${encodeURIComponent(teamName)}/live`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const DEFAULT_LIVE_SCORE_PREFS: LiveScorePreferences = {
  enabled: false,
  goals: true,
  matchStart: true,
  matchEnd: true,
  halfTime: true,
  redCards: true,
};

export async function getLiveScorePreferences(
  userId: string,
): Promise<LiveScorePreferences> {
  try {
    const data = await getNotifications(userId);
    const prefs = data.preferences as Record<string, unknown> | null;
    return (prefs?.liveScores as LiveScorePreferences) ?? DEFAULT_LIVE_SCORE_PREFS;
  } catch {
    return DEFAULT_LIVE_SCORE_PREFS;
  }
}

export async function updateLiveScorePreferences(
  userId: string,
  prefs: Partial<LiveScorePreferences>,
): Promise<{ liveScores: LiveScorePreferences }> {
  const res = await authFetch(`${API_BASE}/users/${userId}/notifications/live-scores`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Organizations (B2B)
// ---------------------------------------------------------------------------

export async function joinOrganization(inviteCode: string): Promise<JoinOrganizationResponse> {
  const res = await authFetch(`${API_BASE}/auth/join-organization`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error?.message || `Error ${res.status}`);
    (err as Record<string, unknown>).status = res.status;
    throw err;
  }
  return res.json();
}

export async function getOrganization(orgId: string): Promise<Organization> {
  const res = await authFetch(`${API_BASE}/organizations/${orgId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getOrgMembers(
  orgId: string,
  params?: { page?: number; limit?: number; sort?: string },
): Promise<{ members: OrganizationMember[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.sort) qs.set('sort', params.sort);
  const res = await authFetch(`${API_BASE}/organizations/${orgId}/members?${qs}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getOrgActivity(
  orgId: string,
  period?: '7d' | '30d' | 'all',
): Promise<OrganizationActivity> {
  const qs = period ? `?period=${period}` : '';
  const res = await authFetch(`${API_BASE}/organizations/${orgId}/activity${qs}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function leaveOrganization(orgId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/organizations/${orgId}/leave`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}
