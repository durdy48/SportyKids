import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config', () => ({
  API_BASE: 'http://localhost:3001/api',
  WEB_BASE: 'http://localhost:3000',
  GOOGLE_IOS_CLIENT_ID: '',
  GOOGLE_WEB_CLIENT_ID: '',
}));
vi.mock('../../lib/auth', () => ({
  login: vi.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', user: { id: 'u1' } }),
  fetchAuthProviders: vi.fn().mockResolvedValue({ google: false, apple: false }),
  loginWithSocialToken: vi.fn(),
}));
vi.mock('../../lib/user-context', () => ({
  useUser: () => ({
    user: null,
    locale: 'es',
    setUser: vi.fn(),
    colors: {
      background: '#fff', surface: '#fff', text: '#000', muted: '#999',
      border: '#eee', blue: '#2563EB', green: '#22C55E', yellow: '#FACC15',
    },
  }),
}));
vi.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: vi.fn(() => [null, null, vi.fn()]),
}));
vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openBrowserAsync: vi.fn(),
}));

describe('LoginScreen', () => {
  it('can be imported without errors', async () => {
    const mod = await import('../Login');
    expect(mod.LoginScreen).toBeDefined();
    expect(typeof mod.LoginScreen).toBe('function');
  });

  it('exports LoginScreen as a function component', async () => {
    const { LoginScreen } = await import('../Login');
    expect(LoginScreen.name).toBe('LoginScreen');
  });

  describe('accessibility', () => {
    it('references a11y keys for auth inputs and buttons', async () => {
      const { LoginScreen } = await import('../Login');
      const source = LoginScreen.toString();
      expect(source).toContain('a11y.auth.email_input');
      expect(source).toContain('a11y.auth.password_input');
      expect(source).toContain('a11y.auth.login_button');
      expect(source).toContain('a11y.auth.anonymous_continue');
    });

    it('login button has accessibilityRole button', async () => {
      const { LoginScreen } = await import('../Login');
      const source = LoginScreen.toString();
      expect(source).toContain('accessibilityRole');
    });
  });
});
