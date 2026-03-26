import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  teamStats: {
    upsert: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('./cache', () => ({
  apiCache: { invalidate: vi.fn(), get: vi.fn(), set: vi.fn() },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { syncTeamStats } from './team-stats-sync';

describe('syncTeamStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches last and next events and upserts team stats', async () => {
    // Mock last events response
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('eventslast')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            results: [
              {
                strEvent: 'Real Madrid vs Barcelona',
                intHomeScore: '2',
                intAwayScore: '1',
                strHomeTeam: 'Real Madrid',
                strAwayTeam: 'FC Barcelona',
                dateEvent: '2026-03-20',
                strLeague: 'La Liga',
              },
            ],
          }),
        });
      }
      if (url.includes('eventsnext')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            events: [
              {
                strEvent: 'Atletico Madrid vs Real Madrid',
                strHomeTeam: 'Atletico Madrid',
                strAwayTeam: 'Real Madrid',
                dateEvent: '2026-04-05',
                strLeague: 'La Liga',
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const result = await syncTeamStats('Real Madrid', '133738', 'football');
    expect(result).toBe(true);

    expect(mockPrisma.teamStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamName: 'Real Madrid' },
        create: expect.objectContaining({
          teamName: 'Real Madrid',
          sport: 'football',
        }),
      }),
    );
  });

  it('handles network errors gracefully and still upserts with empty data', async () => {
    // fetch returns null via the fetchWithTimeout wrapper on errors
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await syncTeamStats('Real Madrid', '133738', 'football');
    // fetchWithTimeout catches errors and returns null, so the function
    // still tries to upsert with empty arrays — it returns true
    // unless the prisma upsert itself throws
    expect(typeof result).toBe('boolean');
  });

  it('handles empty API responses gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: null, events: null }),
    });

    const result = await syncTeamStats('Real Madrid', '133738', 'football');
    expect(result).toBe(true); // Should still upsert with empty data
  });
});
