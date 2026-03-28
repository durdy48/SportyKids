import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;

// We need to mock the config module before importing api
vi.mock('../../config', () => ({
  API_BASE: 'http://localhost:3001/api',
}));

import {
  fetchNews,
  fetchTrending,
  fetchQuestions,
  submitAnswer,
  createUser,
  getUser,
  fetchReels,
  fetchTeamStats,
  fetchReadingHistory,
  fetchRelatedArticles,
} from '../api';

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // -------------------------------------------------------------------------
  // fetchNews
  // -------------------------------------------------------------------------

  describe('fetchNews', () => {
    it('constructs correct URL with no filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ news: [], total: 0, page: 1, totalPages: 0 }),
      });

      await fetchNews();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/news?');
    });

    it('includes all provided filter params in the URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ news: [], total: 0, page: 1, totalPages: 0 }),
      });

      await fetchNews({ sport: 'football', team: 'Real Madrid', page: 2, limit: 10, q: 'gol' });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('sport=football');
      expect(url).toContain('team=Real+Madrid');
      expect(url).toContain('page=2');
      expect(url).toContain('limit=10');
      expect(url).toContain('q=gol');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(fetchNews()).rejects.toThrow('Error 500');
    });

    it('returns parsed JSON on success', async () => {
      const data = { news: [{ id: '1', title: 'Test' }], total: 1, page: 1, totalPages: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(data),
      });

      const result = await fetchNews();
      expect(result).toEqual(data);
    });
  });

  // -------------------------------------------------------------------------
  // fetchTrending
  // -------------------------------------------------------------------------

  describe('fetchTrending', () => {
    it('returns empty array on failure (graceful)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await fetchTrending();
      expect(result).toEqual({ trendingIds: [] });
    });

    it('returns empty array on network error (graceful)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchTrending();
      expect(result).toEqual({ trendingIds: [] });
    });
  });

  // -------------------------------------------------------------------------
  // fetchQuestions
  // -------------------------------------------------------------------------

  describe('fetchQuestions', () => {
    it('passes count, sport, and age params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ questions: [] }),
      });

      await fetchQuestions(10, 'tennis', '9-11');

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('count=10');
      expect(url).toContain('sport=tennis');
      expect(url).toContain('age=9-11');
    });
  });

  // -------------------------------------------------------------------------
  // submitAnswer
  // -------------------------------------------------------------------------

  describe('submitAnswer', () => {
    it('sends POST with correct body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ correct: true, correctAnswer: 2, pointsEarned: 10 }),
      });

      const result = await submitAnswer('user1', 'q1', 2);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/quiz/answer'),
        expect.objectContaining({ method: 'POST' }),
      );
      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toEqual({ userId: 'user1', questionId: 'q1', answer: 2 });
      expect(result.correct).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // createUser
  // -------------------------------------------------------------------------

  describe('createUser', () => {
    it('sends POST with user data', async () => {
      const userData = { name: 'Leo', age: 10, favoriteSports: ['football'], selectedFeeds: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1', ...userData }),
      });

      const result = await createUser(userData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.name).toBe('Leo');
    });
  });

  // -------------------------------------------------------------------------
  // getUser
  // -------------------------------------------------------------------------

  describe('getUser', () => {
    it('fetches user by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'u1', name: 'Ana' }),
      });

      const user = await getUser('u1');
      expect(mockFetch.mock.calls[0][0]).toContain('/users/u1');
      expect(user.name).toBe('Ana');
    });
  });

  // -------------------------------------------------------------------------
  // fetchReels
  // -------------------------------------------------------------------------

  describe('fetchReels', () => {
    it('includes sport filter in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reels: [], total: 0, page: 1, totalPages: 0 }),
      });

      await fetchReels({ sport: 'basketball' });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('sport=basketball');
    });
  });

  // -------------------------------------------------------------------------
  // fetchTeamStats — graceful null on error
  // -------------------------------------------------------------------------

  describe('fetchTeamStats', () => {
    it('returns null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fail'));
      const result = await fetchTeamStats('FC Barcelona');
      expect(result).toBeNull();
    });

    it('returns null on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const result = await fetchTeamStats('Unknown');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // fetchReadingHistory — graceful fallback
  // -------------------------------------------------------------------------

  describe('fetchReadingHistory', () => {
    it('returns empty on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fail'));
      const result = await fetchReadingHistory('u1');
      expect(result).toEqual({ history: [], total: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // fetchRelatedArticles — graceful fallback
  // -------------------------------------------------------------------------

  describe('fetchRelatedArticles', () => {
    it('returns empty on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fail'));
      const result = await fetchRelatedArticles('n1');
      expect(result).toEqual({ related: [] });
    });
  });
});
