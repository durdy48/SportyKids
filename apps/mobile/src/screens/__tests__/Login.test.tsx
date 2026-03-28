import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config', () => ({ API_BASE: 'http://localhost:3001/api' }));
vi.mock('../../lib/auth', () => ({
  login: vi.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', user: { id: 'u1' } }),
}));
vi.mock('../../lib/user-context', () => ({
  useUser: () => ({
    user: null,
    locale: 'es',
    setUser: vi.fn(),
  }),
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
});
