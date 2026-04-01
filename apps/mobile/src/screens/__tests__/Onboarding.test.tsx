import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config', () => ({ API_BASE: 'http://localhost:3001/api' }));
vi.mock('../../lib/api', () => ({
  createUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Test' }),
  fetchSourceCatalog: vi.fn().mockResolvedValue({ sources: [], totalCount: 0, bySport: {} }),
  setupParentalPin: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../lib/user-context', () => ({
  useUser: () => ({
    user: null,
    locale: 'es',
    setUser: vi.fn(),
    setParentalProfile: vi.fn(),
    setLocale: vi.fn(),
  }),
}));

describe('OnboardingScreen', () => {
  it('can be imported without errors', async () => {
    const mod = await import('../Onboarding');
    expect(mod.OnboardingScreen).toBeDefined();
    expect(typeof mod.OnboardingScreen).toBe('function');
  });

  it('exports OnboardingScreen as a function component', async () => {
    const { OnboardingScreen } = await import('../Onboarding');
    expect(OnboardingScreen.name).toBe('OnboardingScreen');
  });

  describe('accessibility', () => {
    it('sport selection buttons have a11y labels', async () => {
      const { OnboardingScreen } = await import('../Onboarding');
      const source = OnboardingScreen.toString();
      expect(source).toContain('a11y.onboarding.select_sport');
      expect(source).toContain('a11y.onboarding.deselect_sport');
    });

    it('team selection buttons have a11y labels', async () => {
      const { OnboardingScreen } = await import('../Onboarding');
      const source = OnboardingScreen.toString();
      expect(source).toContain('a11y.onboarding.select_team');
    });

    it('navigation buttons have accessibilityRole', async () => {
      const { OnboardingScreen } = await import('../Onboarding');
      const source = OnboardingScreen.toString();
      expect(source).toContain('accessibilityRole');
      expect(source).toContain('a11y.common.back');
      expect(source).toContain('a11y.onboarding.next');
    });
  });
});
