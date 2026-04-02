import type { NewsItem, Reel, QuizQuestion, User, ParentalProfile, RssSource, RssSourceCatalogResponse, Sticker, UserSticker, Achievement, UserAchievement, CheckInResponse, TeamStats, PushPreferences, LiveMatchData, LiveScorePreferences, Organization, OrganizationMember, OrganizationActivity, JoinOrganizationResponse } from '@sportykids/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Parse a 403 response from the parental guard into a rich error.
 *
 * The centralized error handler returns `{ error: { code, message, details } }`.
 * Schedule lock details are in `body.error.details`.
 */
function parseParentalBlockError(body: Record<string, unknown>): Error {
  const errorObj = body.error as Record<string, unknown> | undefined;
  const details = (errorObj?.details ?? {}) as Record<string, unknown>;
  const message = (errorObj?.message as string) ?? (typeof body.error === 'string' ? body.error : 'forbidden');
  return Object.assign(new Error(message), {
    reason: details.error ?? errorObj?.code ?? 'forbidden',
    allowedHoursStart: details.allowedHoursStart,
    allowedHoursEnd: details.allowedHoursEnd,
    status: 403,
  });
}

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

export async function fetchNewsSummary(
  newsId: string,
  age: number,
  locale: string
): Promise<{ summary: string; ageRange: string; generatedAt: string }> {
  const res = await fetch(`${API_BASE}/news/${newsId}/summary?age=${age}&locale=${locale}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
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

  const res = await fetch(`${API_BASE}/news?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      throw parseParentalBlockError(body);
    }
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

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
  consentBy?: string;
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

export interface RssSourceInfo {
  id: string;
  name: string;
  sport: string;
}

export async function fetchSources(): Promise<RssSourceInfo[]> {
  const res = await fetch(`${API_BASE}/news/sources/list`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchSourceCatalog(): Promise<RssSourceCatalogResponse> {
  const res = await fetch(`${API_BASE}/news/sources/catalog`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function addCustomSource(data: { url: string; name: string; sport: string; userId: string }): Promise<RssSource> {
  const res = await fetch(`${API_BASE}/news/sources/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function deleteCustomSource(sourceId: string, userId?: string): Promise<void> {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const res = await fetch(`${API_BASE}/news/sources/custom/${sourceId}${params}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

// Trending
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

// Reels
export interface ReelsResponse {
  reels: Reel[];
  total: number;
  page: number;
  totalPages: number;
}

export async function fetchReels(filters: { sport?: string; page?: number; limit?: number; userId?: string } = {}): Promise<ReelsResponse> {
  const params = new URLSearchParams();
  if (filters.sport) params.set('sport', filters.sport);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.userId) params.set('userId', filters.userId);
  const res = await fetch(`${API_BASE}/reels?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      throw parseParentalBlockError(body);
    }
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// Quiz
export async function fetchQuestions(count: number = 5, sport?: string, age?: string, userId?: string): Promise<{ questions: QuizQuestion[] }> {
  const params = new URLSearchParams({ count: String(count) });
  if (sport) params.set('sport', sport);
  if (age) params.set('age', age);
  if (userId) params.set('userId', userId);
  const res = await fetch(`${API_BASE}/quiz/questions?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      throw parseParentalBlockError(body);
    }
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function submitAnswer(userId: string, questionId: string, answer: number): Promise<{ correct: boolean; correctAnswer: number; pointsEarned: number }> {
  const res = await fetch(`${API_BASE}/quiz/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, questionId, answer }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchScore(userId: string): Promise<{ name: string; totalPoints: number }> {
  const res = await fetch(`${API_BASE}/quiz/score/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// Parental controls — session token management
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

export async function setupParentalPin(userId: string, pin: string, options?: { allowedFormats?: string[]; maxDailyTimeMinutes?: number }): Promise<ParentalProfile> {
  const res = await fetch(`${API_BASE}/parents/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin, ...options }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export interface PinVerifyResult {
  verified: boolean;
  exists?: boolean;
  profile?: ParentalProfile;
  sessionToken?: string;
  // Lockout fields
  attemptsRemaining?: number;
  lockedUntil?: string;
  remainingSeconds?: number;
  error?: string;
  status?: number;
}

export async function verifyPin(userId: string, pin: string): Promise<PinVerifyResult> {
  const res = await fetch(`${API_BASE}/parents/verify-pin`, {
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

export async function getParentalProfile(userId: string): Promise<{ exists: boolean; profile?: ParentalProfile }> {
  const res = await fetch(`${API_BASE}/parents/profile/${userId}`, {
    headers: parentalHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function updateParentalProfile(userId: string, data: Partial<ParentalProfile>): Promise<ParentalProfile> {
  const res = await fetch(`${API_BASE}/parents/profile/${userId}`, {
    method: 'PUT',
    headers: parentalHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function fetchActivity(userId: string): Promise<{ news_viewed: number; reels_viewed: number; quizzes_played: number; totalPoints: number }> {
  const res = await fetch(`${API_BASE}/parents/activity/${userId}`, {
    headers: parentalHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function recordActivity(userId: string, type: string, durationSeconds?: number, contentId?: string, sport?: string): Promise<void> {
  await fetch(`${API_BASE}/parents/activity/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, type, durationSeconds, contentId, sport }),
  });
  // Dispatch custom event so MissionCard can refresh progress
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sportykids:activity-logged', { detail: { type, sport } }));
  }
}

export async function fetchActivityDetail(userId: string, from: string, to: string): Promise<{ days: { date: string; news_viewed: number; reels_viewed: number; quizzes_played: number; totalMinutes: number }[]; mostViewed: string }> {
  const res = await fetch(`${API_BASE}/parents/activity/${userId}/detail?from=${from}&to=${to}`, { headers: parentalHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const data = await res.json();

  // Map API response shape to the format expected by ParentalPanel
  const days = (data.dailyBreakdown ?? []).map((d: { date: string; totalSeconds: number; counts: Record<string, number>; sports: Record<string, number> }) => ({
    date: d.date,
    news_viewed: d.counts?.news_viewed ?? 0,
    reels_viewed: d.counts?.reels_viewed ?? 0,
    quizzes_played: d.counts?.quizzes_played ?? 0,
    totalMinutes: Math.round((d.totalSeconds ?? 0) / 60),
  }));

  // Find most viewed sport from totals
  const bySport = data.totals?.bySport ?? {};
  const mostViewed = Object.entries(bySport).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? '';

  return { days, mostViewed };
}

// Gamification

export async function getStickers(): Promise<{ stickers: Sticker[] }> {
  const res = await fetch(`${API_BASE}/gamification/stickers`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getUserStickers(userId: string): Promise<{ stickers: UserSticker[]; total: number; collected: number }> {
  const res = await fetch(`${API_BASE}/gamification/stickers/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getAchievements(): Promise<{ achievements: Achievement[] }> {
  const res = await fetch(`${API_BASE}/gamification/achievements`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getUserAchievements(userId: string): Promise<{ achievements: UserAchievement[]; total: number; unlocked: number }> {
  const res = await fetch(`${API_BASE}/gamification/achievements/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getStreakInfo(userId: string): Promise<{ currentStreak: number; longestStreak: number; lastActiveDate: string | null }> {
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

// Feed preview (parental)
export async function fetchFeedPreview(userId: string): Promise<{ news: NewsItem[]; reels: Reel[]; quizAvailable: boolean }> {
  const res = await fetch(`${API_BASE}/parents/preview/${userId}`, { headers: parentalHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// Content reports
export async function submitReport(data: { userId: string; contentType: 'news' | 'reel'; contentId: string; reason: string; comment?: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed');
  }
}

export interface ContentReportWithTitle {
  id: string;
  contentType: 'news' | 'reel';
  contentId: string;
  contentTitle: string | null;
  reason: string;
  comment?: string;
  status: string;
  reviewedAt: string | null;
  createdAt: string;
}

export async function fetchReports(userId: string): Promise<ContentReportWithTitle[]> {
  const res = await fetch(`${API_BASE}/reports/parent/${userId}`);
  if (!res.ok) throw new Error('Failed');
  const data = await res.json();
  return Array.isArray(data) ? data : data.reports ?? [];
}

export async function updateReportStatus(reportId: string, status: 'reviewed' | 'dismissed' | 'actioned'): Promise<void> {
  const res = await fetch(`${API_BASE}/reports/${reportId}`, {
    method: 'PUT',
    headers: parentalHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed');
}

// Team stats
export async function fetchTeamStats(teamName: string): Promise<TeamStats | null> {
  try {
    const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(teamName)}/stats`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Notifications
export async function subscribeNotifications(
  userId: string,
  data: { enabled: boolean; preferences: PushPreferences }
): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/notifications/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

export async function getNotifications(userId: string): Promise<{ enabled: boolean; preferences: PushPreferences }> {
  const res = await fetch(`${API_BASE}/users/${userId}/notifications`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// Weekly Digest (B-PT1)
export async function getDigestPreferences(userId: string) {
  const res = await fetch(`${API_BASE}/parents/digest/${userId}`, { headers: parentalHeaders() });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function updateDigestPreferences(userId: string, data: { digestEnabled?: boolean; digestEmail?: string | null; digestDay?: number }) {
  const res = await fetch(`${API_BASE}/parents/digest/${userId}`, { method: 'PUT', headers: parentalHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function previewDigest(userId: string) {
  const res = await fetch(`${API_BASE}/parents/digest/${userId}/preview`, { headers: parentalHeaders() });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function downloadDigestPdf(userId: string) {
  const res = await fetch(`${API_BASE}/parents/digest/${userId}/download`, { headers: parentalHeaders() });
  if (!res.ok) throw new Error('Failed');
  return res.blob();
}

export async function sendTestDigestEmail(userId: string): Promise<{ ok: boolean; sentTo: string }> {
  const res = await fetch(`${API_BASE}/parents/digest/${userId}/test`, {
    method: 'POST',
    headers: parentalHeaders({ 'Content-Type': 'application/json' }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed');
  }
  return res.json();
}

// Reading history (B-EN4)
export async function fetchReadingHistory(userId: string, page = 1, limit = 10): Promise<{ history: NewsItem[]; total: number }> {
  const res = await fetch(`${API_BASE}/news/history?userId=${userId}&page=${page}&limit=${limit}`);
  if (!res.ok) return { history: [], total: 0 };
  return res.json();
}

// Content recommendations (B-CP4)
export async function fetchRelatedArticles(newsId: string, limit = 5): Promise<{ related: NewsItem[] }> {
  try {
    const res = await fetch(`${API_BASE}/news/${newsId}/related?limit=${limit}`);
    if (!res.ok) return { related: [] };
    return res.json();
  } catch {
    return { related: [] };
  }
}

// Auth providers
export async function fetchAuthProviders(): Promise<{ google: boolean; apple: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/auth/providers`);
    if (!res.ok) return { google: false, apple: false };
    return res.json();
  } catch {
    return { google: false, apple: false };
  }
}

// Team stats sync (B-CP3)
export async function syncTeamStats(): Promise<{ synced: number; failed: number }> {
  const res = await fetch(`${API_BASE}/teams/sync`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

// Missions (B-EN1)
export async function fetchTodayMission(userId: string) {
  const res = await fetch(`${API_BASE}/missions/today/${userId}`);
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function claimMission(userId: string) {
  const res = await fetch(`${API_BASE}/missions/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function deleteUserData(userId: string, sessionToken?: string) {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (sessionToken) {
    headers['X-Parental-Session'] = sessionToken;
  }
  const res = await fetch(`${API_BASE}/users/${userId}/data`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete user data');
  return res.json();
}

// Live scores
export async function getLiveMatch(teamName: string): Promise<LiveMatchData | null> {
  try {
    const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(teamName)}/live`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function updateLiveScorePreferences(
  userId: string,
  prefs: Partial<LiveScorePreferences>,
): Promise<{ liveScores: LiveScorePreferences }> {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/users/${userId}/notifications/live-scores`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Organizations (B2B)
// ---------------------------------------------------------------------------

export async function createOrganization(data: {
  name: string;
  sport: string;
  logoUrl?: string;
  customColors?: { primary: string; secondary: string };
  maxMembers?: number;
}): Promise<Organization> {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/organizations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status}`);
  }
  return res.json();
}

export async function getOrganization(orgId: string): Promise<Organization> {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/organizations/${orgId}`, { headers });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function updateOrganization(
  orgId: string,
  data: Partial<{ name: string; logoUrl: string | null; customColors: { primary: string; secondary: string } | null; maxMembers: number; active: boolean }>,
): Promise<Organization> {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/organizations/${orgId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function regenerateOrgCode(orgId: string): Promise<{ inviteCode: string }> {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/organizations/${orgId}/regenerate-code`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getOrgMembers(
  orgId: string,
  params?: { page?: number; limit?: number; sort?: string },
): Promise<{ members: OrganizationMember[]; total: number; page: number; limit: number }> {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.sort) qs.set('sort', params.sort);
  const res = await fetch(`${API_BASE}/organizations/${orgId}/members?${qs}`, { headers });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/organizations/${orgId}/members/${userId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

export async function leaveOrganization(orgId: string): Promise<void> {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/organizations/${orgId}/leave`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
}

export async function getOrgActivity(
  orgId: string,
  period?: '7d' | '30d' | 'all',
): Promise<OrganizationActivity> {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const qs = period ? `?period=${period}` : '';
  const res = await fetch(`${API_BASE}/organizations/${orgId}/activity${qs}`, { headers });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function joinOrganization(inviteCode: string): Promise<JoinOrganizationResponse> {
  const { getAccessToken } = await import('./auth');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/auth/join-organization`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ inviteCode: inviteCode.toUpperCase() }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error?.message || `Error ${res.status}`);
    (err as unknown as Record<string, unknown>).status = res.status;
    throw err;
  }
  return res.json();
}
