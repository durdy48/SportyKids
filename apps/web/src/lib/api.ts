import type { NewsItem, Reel, QuizQuestion, User, ParentalProfile } from '@sportykids/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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
  page?: number;
  limit?: number;
}

export async function fetchNews(filters: NewsFilters = {}): Promise<NewsResponse> {
  const params = new URLSearchParams();
  if (filters.sport) params.set('sport', filters.sport);
  if (filters.team) params.set('team', filters.team);
  if (filters.age) params.set('age', String(filters.age));
  if (filters.source) params.set('source', filters.source);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const res = await fetch(`${API_BASE}/news?${params.toString()}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

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

// Reels
export interface ReelsResponse {
  reels: Reel[];
  total: number;
  page: number;
  totalPages: number;
}

export async function fetchReels(filters: { sport?: string; page?: number; limit?: number } = {}): Promise<ReelsResponse> {
  const params = new URLSearchParams();
  if (filters.sport) params.set('sport', filters.sport);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const res = await fetch(`${API_BASE}/reels?${params.toString()}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

// Quiz
export async function fetchQuestions(count: number = 5, sport?: string): Promise<{ questions: QuizQuestion[] }> {
  const params = new URLSearchParams({ count: String(count) });
  if (sport) params.set('sport', sport);
  const res = await fetch(`${API_BASE}/quiz/questions?${params.toString()}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
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

// Parental controls
export async function setupParentalPin(userId: string, pin: string, options?: { allowedFormats?: string[]; maxDailyTimeMinutes?: number }): Promise<ParentalProfile> {
  const res = await fetch(`${API_BASE}/parents/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin, ...options }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function verifyPin(userId: string, pin: string): Promise<{ verified: boolean; exists: boolean; profile?: ParentalProfile }> {
  const res = await fetch(`${API_BASE}/parents/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function getParentalProfile(userId: string): Promise<{ exists: boolean; profile?: ParentalProfile }> {
  const res = await fetch(`${API_BASE}/parents/profile/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function updateParentalProfile(userId: string, data: Partial<ParentalProfile>): Promise<ParentalProfile> {
  const res = await fetch(`${API_BASE}/parents/profile/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function fetchActivity(userId: string): Promise<{ news_viewed: number; reels_viewed: number; quizzes_played: number; totalPoints: number }> {
  const res = await fetch(`${API_BASE}/parents/activity/${userId}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function recordActivity(userId: string, type: string): Promise<void> {
  await fetch(`${API_BASE}/parents/activity/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, type }),
  });
}
