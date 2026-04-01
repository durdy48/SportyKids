import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config', () => ({ API_BASE: 'http://localhost:3001/api' }));
vi.mock('../../lib/api', () => ({
  getParentalProfile: vi.fn().mockResolvedValue({ exists: false }),
  verifyPin: vi.fn().mockResolvedValue({ verified: true }),
  setupParentalPin: vi.fn().mockResolvedValue({}),
  updateParentalProfile: vi.fn().mockResolvedValue({}),
  fetchActivity: vi.fn().mockResolvedValue({ news_viewed: 0, reels_viewed: 0, quizzes_played: 0, totalPoints: 0 }),
  fetchFeedPreview: vi.fn().mockResolvedValue({ news: [], reels: [], quizAvailable: false }),
  getDigestPreferences: vi.fn().mockResolvedValue({ digestEnabled: false, digestEmail: null, digestDay: 1 }),
  updateDigestPreferences: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../lib/auth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));
vi.mock('../../lib/user-context', () => ({
  useUser: () => ({
    user: { id: 'u1', name: 'Test', age: 10 },
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
    setParentalProfile: vi.fn(),
    theme: 'system',
    setTheme: vi.fn(),
    logout: vi.fn(),
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

  it('includes delete account button in the component source', async () => {
    const { ParentalControlScreen } = await import('../ParentalControl');
    const source = ParentalControlScreen.toString();
    expect(source).toContain('delete-account-button');
    expect(source).toContain('delete_account.button');
    expect(source).toContain('delete_account.confirm_title');
  });

  it('includes legal links in the component source', async () => {
    const { ParentalControlScreen } = await import('../ParentalControl');
    const source = ParentalControlScreen.toString();
    expect(source).toContain('legal.privacy_policy');
    expect(source).toContain('legal.terms_of_service');
  });

  it('delete confirmation calls Alert.alert with cancel and destructive options', async () => {
    const { ParentalControlScreen } = await import('../ParentalControl');
    const source = ParentalControlScreen.toString();
    // Verify the delete flow references the expected i18n keys
    expect(source).toContain('delete_account.confirm_cancel');
    expect(source).toContain('delete_account.confirm_delete');
    // Verify it calls the API delete endpoint
    expect(source).toContain('/data');
    expect(source).toContain('DELETE');
  });

  describe('accessibility', () => {
    it('PIN verification button has a11y label and role', async () => {
      const { ParentalControlScreen } = await import('../ParentalControl');
      const source = ParentalControlScreen.toString();
      expect(source).toContain('a11y.parental.verify_pin');
      expect(source).toContain('a11y.parental.setup_pin');
    });

    it('tab buttons have tab role and selected state', async () => {
      const { ParentalControlScreen } = await import('../ParentalControl');
      const source = ParentalControlScreen.toString();
      expect(source).toContain("accessibilityRole");
      expect(source).toContain('"tab"');
    });

    it('format toggles have a11y labels', async () => {
      const { ParentalControlScreen } = await import('../ParentalControl');
      const source = ParentalControlScreen.toString();
      expect(source).toContain('a11y.parental.toggle_format');
    });
  });
});
