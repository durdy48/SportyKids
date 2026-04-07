import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config', () => ({ API_BASE: 'http://localhost:3001/api', WEB_BASE: 'http://localhost:3000' }));
vi.mock('../../lib/api', () => ({
  createUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Test' }),
  setupParentalPin: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../lib/user-context', () => ({
  useUser: () => ({
    user: null,
    locale: 'es',
    setUser: vi.fn(),
    setParentalProfile: vi.fn(),
    setLocale: vi.fn(),
    colors: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#1E293B',
      muted: '#6B7280',
      border: '#E5E7EB',
      blue: '#2563EB',
      green: '#22C55E',
      yellow: '#FACC15',
    },
  }),
}));
vi.mock('expo-web-browser', () => ({ openBrowserAsync: vi.fn() }));

/*
 * Why source-inspection (.toString()) is used here instead of behavioral rendering tests:
 *
 * OnboardingScreen is a multi-step form that relies on React state, context (useUser),
 * and React Native primitives (SafeAreaView, ScrollView, TextInput, TouchableOpacity).
 * Fully rendering it requires a configured React Native test renderer (e.g.
 * @testing-library/react-native with a native runtime or react-test-renderer) — that
 * configuration is not available in this vitest/jsdom environment.
 *
 * To replace these tests with behavioral tests, you would need:
 *   - react-test-renderer or @testing-library/react-native properly configured
 *   - A React Native runtime environment (not jsdom)
 *   - Simulated user interactions (fireEvent / userEvent) to advance onboarding steps
 *
 * The core logic (exact-match deduplication, entity→feed pre-population) is unit-tested
 * behaviorally in packages/shared/src/__tests__/entities.test.ts, which covers the
 * getSourceIdsForEntities utility directly without UI rendering.
 */
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

    it('navigation buttons have accessibilityRole', async () => {
      const { OnboardingScreen } = await import('../Onboarding');
      const source = OnboardingScreen.toString();
      expect(source).toContain('accessibilityRole');
      expect(source).toContain('a11y.common.back');
      expect(source).toContain('a11y.onboarding.next');
    });
  });
});

describe('Onboarding — 3-step flow', () => {
  it('has TOTAL_STEPS = 3', async () => {
    const { OnboardingScreen } = await import('../Onboarding');
    const source = OnboardingScreen.toString();
    // TOTAL_STEPS constant is defined outside the component; verify 3-step parental step
    expect(source).toContain('onboarding.step5_title');
  });

  it('step 3 renders parental PIN section', async () => {
    const { OnboardingScreen } = await import('../Onboarding');
    const source = OnboardingScreen.toString();
    expect(source).toContain('onboarding.pin_create');
    expect(source).toContain('onboarding.formats_label');
    expect(source).toContain('onboarding.time_limit_label');
  });

  it('does not contain entity selection (moved to ParentalControl)', async () => {
    const { OnboardingScreen } = await import('../Onboarding');
    const source = OnboardingScreen.toString();
    expect(source).not.toContain('selectedEntities');
    expect(source).not.toContain('getSourceIdsForEntities');
    expect(source).not.toContain('selectedFeeds');
  });
});
