import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';

const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;

vi.mock('../../config', () => ({
  API_BASE: 'http://localhost:3001/api',
}));

// Reset the secure-storage module's cached SecureStore reference between tests
// so each test gets a fresh state.
import { _resetSecureStoreCache } from '../secure-storage';
import { register, login, getAccessToken, refreshToken, logout } from '../auth';

const ACCESS_TOKEN_KEY = 'sportykids_access_token';
const REFRESH_TOKEN_KEY = 'sportykids_refresh_token';

describe('auth', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    _resetSecureStoreCache();
    vi.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
    vi.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue(undefined);
    vi.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  describe('register', () => {
    it('stores tokens on successful registration', async () => {
      const authResponse = {
        accessToken: 'at-123',
        refreshToken: 'rt-456',
        user: { id: 'u1', name: 'Leo', email: 'leo@test.com' },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authResponse),
      });

      const result = await register({ email: 'leo@test.com', password: 'pass123', name: 'Leo', age: 10 });

      expect(result.accessToken).toBe('at-123');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(ACCESS_TOKEN_KEY, 'at-123');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'rt-456');
    });

    it('throws on failed registration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'Email already exists' }),
      });

      await expect(register({ email: 'a@b.com', password: 'x', name: 'A', age: 8 }))
        .rejects.toThrow('Email already exists');
    });
  });

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------

  describe('login', () => {
    it('stores tokens on successful login', async () => {
      const authResponse = {
        accessToken: 'at-abc',
        refreshToken: 'rt-def',
        user: { id: 'u2', name: 'Ana' },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(authResponse),
      });

      const result = await login({ email: 'ana@test.com', password: 'pwd' });

      expect(result.user.name).toBe('Ana');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(ACCESS_TOKEN_KEY, 'at-abc');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'rt-def');
    });

    it('throws descriptive error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      });

      await expect(login({ email: 'bad@test.com', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials');
    });
  });

  // -------------------------------------------------------------------------
  // getAccessToken
  // -------------------------------------------------------------------------

  describe('getAccessToken', () => {
    it('returns token from SecureStore', async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue('my-token');

      const token = await getAccessToken();
      expect(token).toBe('my-token');
    });

    it('returns null when no token stored', async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

      const token = await getAccessToken();
      expect(token).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // refreshToken
  // -------------------------------------------------------------------------

  describe('refreshToken', () => {
    it('exchanges refresh token for new access token', async () => {
      vi.mocked(SecureStore.getItemAsync)
        .mockResolvedValueOnce(null) // probe
        .mockResolvedValueOnce('old-rt'); // actual read
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: 'new-at', refreshToken: 'new-rt' }),
      });

      const newAt = await refreshToken();

      expect(newAt).toBe('new-at');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(ACCESS_TOKEN_KEY, 'new-at');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'new-rt');
    });

    it('returns null and clears tokens on failed refresh', async () => {
      vi.mocked(SecureStore.getItemAsync)
        .mockResolvedValueOnce(null) // probe
        .mockResolvedValueOnce('old-rt');
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await refreshToken();

      expect(result).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
    });

    it('returns null when no refresh token stored', async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

      const result = await refreshToken();
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------

  describe('logout', () => {
    it('calls logout endpoint and clears tokens', async () => {
      vi.mocked(SecureStore.getItemAsync)
        .mockResolvedValueOnce(null) // probe
        .mockResolvedValueOnce('rt-to-revoke');
      mockFetch.mockResolvedValueOnce({ ok: true });

      await logout();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
    });

    it('clears tokens even when no refresh token exists', async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

      await logout();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
    });
  });
});
