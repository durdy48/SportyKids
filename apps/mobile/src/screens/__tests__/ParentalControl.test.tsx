import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config', () => ({ API_BASE: 'http://localhost:3001/api' }));
vi.mock('../../lib/api', () => ({
  getParentalProfile: vi.fn().mockResolvedValue({ exists: false }),
  verifyPin: vi.fn().mockResolvedValue({ verified: true }),
  setupParentalPin: vi.fn().mockResolvedValue({}),
  updateParentalProfile: vi.fn().mockResolvedValue({}),
  fetchActivity: vi.fn().mockResolvedValue({ news_viewed: 0, reels_viewed: 0, quizzes_played: 0, totalPoints: 0 }),
}));
vi.mock('../../lib/user-context', () => ({
  useUser: () => ({
    user: { id: 'u1', name: 'Test', age: 10 },
    locale: 'es',
    setParentalProfile: vi.fn(),
  }),
}));

describe('ParentalControlScreen', () => {
  it('can be imported without errors', async () => {
    const mod = await import('../ParentalControl');
    expect(mod.ParentalControlScreen).toBeDefined();
    expect(typeof mod.ParentalControlScreen).toBe('function');
  });

  it('exports ParentalControlScreen as a function', async () => {
    const { ParentalControlScreen } = await import('../ParentalControl');
    expect(ParentalControlScreen.name).toBe('ParentalControlScreen');
  });
});
