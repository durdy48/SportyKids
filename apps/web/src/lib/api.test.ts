import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNews, createUser, fetchScore, fetchTrending } from './api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchNews', () => {
    it('constructs URL with sport and page filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ news: [], total: 0, page: 1, totalPages: 0 }),
      });

      await fetchNews({ sport: 'football', page: 2 });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('sport=football');
      expect(calledUrl).toContain('page=2');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(fetchNews()).rejects.toThrow('Error 500');
    });

    it('throws enriched error on 403 with schedule info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          error: {
            code: 'AUTHORIZATION_ERROR',
            message: 'Outside allowed hours',
            details: { error: 'schedule_locked', allowedHoursStart: 8, allowedHoursEnd: 20 },
          },
        }),
      });

      try {
        await fetchNews();
        expect.fail('should have thrown');
      } catch (err: unknown) {
        const e = err as Record<string, unknown>;
        expect(e.reason).toBe('schedule_locked');
        expect(e.allowedHoursStart).toBe(8);
        expect(e.allowedHoursEnd).toBe(20);
      }
    });
  });

  describe('createUser', () => {
    it('sends POST with correct body', async () => {
      const userData = { name: 'Test', age: 10, favoriteSports: ['football'], selectedFeeds: ['f1'] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'u1', ...userData }),
      });

      const result = await createUser(userData);
      expect(result.id).toBe('u1');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/users');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toMatchObject(userData);
    });
  });

  describe('fetchScore', () => {
    it('fetches score for a userId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: 'Ana', totalPoints: 150 }),
      });

      const result = await fetchScore('u1');
      expect(result.totalPoints).toBe(150);
      expect(mockFetch.mock.calls[0][0]).toContain('/quiz/score/u1');
    });
  });

  describe('fetchTrending', () => {
    it('returns empty array on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await fetchTrending();
      expect(result.trendingIds).toEqual([]);
    });
  });
});
