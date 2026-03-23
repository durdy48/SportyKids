import type { NewsItem } from '@sportykids/shared';

// In development use local IP (localhost won't work on physical devices)
const API_BASE = 'http://192.168.1.189:3001/api';

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
  page?: number;
  limit?: number;
}

export async function fetchNews(filters: NewsFilters = {}): Promise<NewsResponse> {
  const params = new URLSearchParams();
  if (filters.sport) params.set('sport', filters.sport);
  if (filters.team) params.set('team', filters.team);
  if (filters.age) params.set('age', String(filters.age));
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const res = await fetch(`${API_BASE}/news?${params.toString()}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}
