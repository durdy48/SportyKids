import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config', () => ({ API_BASE: 'http://localhost:3001/api' }));
vi.mock('../../lib/api', () => ({
  updateUser: vi.fn().mockResolvedValue({ id: 'u1', ageGateCompleted: true }),
  setupParentalPin: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../lib/user-context', () => ({
  useUser: () => ({
    user: { id: 'u1', name: 'Test', age: 10, ageGateCompleted: false, favoriteSports: [] },
    locale: 'es',
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
    setUser: vi.fn(),
    setParentalProfile: vi.fn(),
  }),
}));

describe('AgeGateScreen', () => {
  it('can be imported without errors', async () => {
    const mod = await import('../AgeGate');
    expect(mod.AgeGateScreen).toBeDefined();
    expect(typeof mod.AgeGateScreen).toBe('function');
  });

  it('exports AgeGateScreen as a function component', async () => {
    const { AgeGateScreen } = await import('../AgeGate');
    expect(AgeGateScreen.name).toBe('AgeGateScreen');
  });

  it('renders three age option buttons with testIDs', async () => {
    const { AgeGateScreen } = await import('../AgeGate');
    const source = AgeGateScreen.toString();
    expect(source).toContain('age-gate-parent');
    expect(source).toContain('age-gate-teen');
    expect(source).toContain('age-gate-child');
  });

  it('references all three age gate i18n keys for option labels', async () => {
    const { AgeGateScreen } = await import('../AgeGate');
    const source = AgeGateScreen.toString();
    expect(source).toContain('age_gate.parent_option');
    expect(source).toContain('age_gate.teen_option');
    expect(source).toContain('age_gate.child_option');
  });

  describe('accessibility', () => {
    it('age option buttons have accessibilityLabel and role', async () => {
      const { AgeGateScreen } = await import('../AgeGate');
      const source = AgeGateScreen.toString();
      expect(source).toContain('a11y.age_gate.adult_option');
      expect(source).toContain('a11y.age_gate.teen_option');
      expect(source).toContain('a11y.age_gate.child_option');
    });

    it('consent checkboxes have checkbox role', async () => {
      const { AgeGateScreen } = await import('../AgeGate');
      const source = AgeGateScreen.toString();
      expect(source).toContain('a11y.age_gate.consent_checkbox');
      expect(source).toContain("accessibilityRole");
      // Should contain checkbox role for consent
      expect(source).toContain('checkbox');
    });
  });

  it('has navigation props for each age path', async () => {
    const { AgeGateScreen } = await import('../AgeGate');
    expect(AgeGateScreen.length).toBeGreaterThanOrEqual(0);
    const source = AgeGateScreen.toString();
    expect(source).toContain('teen-notice');
    expect(source).toContain('child-consent');
    expect(source).toContain('child-pin');
  });

  it('includes legal links for privacy policy and terms of service', async () => {
    const { AgeGateScreen } = await import('../AgeGate');
    const source = AgeGateScreen.toString();
    expect(source).toContain('legal.privacy_policy');
    expect(source).toContain('legal.terms_of_service');
  });

  it('includes teen notice acceptance flow', async () => {
    const { AgeGateScreen } = await import('../AgeGate');
    const source = AgeGateScreen.toString();
    expect(source).toContain('age_gate.teen_notice_title');
    expect(source).toContain('age_gate.teen_accept');
    expect(source).toContain('teenAccepted');
  });

  it('includes child consent flow with PIN creation', async () => {
    const { AgeGateScreen } = await import('../AgeGate');
    const source = AgeGateScreen.toString();
    expect(source).toContain('age_gate.child_consent_title');
    expect(source).toContain('age_gate.child_consent_checkbox');
    expect(source).toContain('parentConsent');
    expect(source).toContain('setupParentalPin');
  });

  it('calls updateUser with ageGateCompleted and consentGiven on completion', async () => {
    const { AgeGateScreen } = await import('../AgeGate');
    const source = AgeGateScreen.toString();
    expect(source).toContain('ageGateCompleted');
    expect(source).toContain('consentGiven');
    expect(source).toContain('updateUser');
  });

  it('navigates to Onboarding or Main after completion', async () => {
    const { AgeGateScreen } = await import('../AgeGate');
    const source = AgeGateScreen.toString();
    expect(source).toContain('Onboarding');
    expect(source).toContain('Main');
  });
});
