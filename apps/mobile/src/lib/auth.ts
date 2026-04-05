import type { AuthResponse, LoginRequest, RegisterRequest } from '@sportykids/shared';
import { API_BASE } from '../config';
import { secureGetItem, secureSetItem, secureDeleteItem, migrateTokensToSecureStore } from './secure-storage';

const ACCESS_TOKEN_KEY = 'sportykids_access_token';
const REFRESH_TOKEN_KEY = 'sportykids_refresh_token';

/**
 * Migrate existing tokens from AsyncStorage to expo-secure-store.
 * Safe to call on every app startup -- it no-ops after the first migration.
 */
export async function initSecureTokenStorage(): Promise<void> {
  await migrateTokensToSecureStore([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }

  const result: AuthResponse = await res.json();
  await storeTokens(result.accessToken, result.refreshToken);
  return result;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }

  const result: AuthResponse = await res.json();
  await storeTokens(result.accessToken, result.refreshToken);
  return result;
}

export async function getAccessToken(): Promise<string | null> {
  return secureGetItem(ACCESS_TOKEN_KEY);
}

export async function refreshToken(): Promise<string | null> {
  const stored = await secureGetItem(REFRESH_TOKEN_KEY);
  if (!stored) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const result = await res.json();
    await storeTokens(result.accessToken, result.refreshToken);
    return result.accessToken;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  const stored = await secureGetItem(REFRESH_TOKEN_KEY);
  if (stored) {
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored }),
    }).catch(() => {}); // Best effort
  }
  await clearTokens();
}

export async function storeTokens(accessToken: string, refreshTokenValue: string): Promise<void> {
  await secureSetItem(ACCESS_TOKEN_KEY, accessToken);
  await secureSetItem(REFRESH_TOKEN_KEY, refreshTokenValue);
}

async function clearTokens(): Promise<void> {
  await secureDeleteItem(ACCESS_TOKEN_KEY);
  await secureDeleteItem(REFRESH_TOKEN_KEY);
}

export async function fetchAuthProviders(): Promise<{ google: boolean; apple: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/auth/providers`);
    if (!res.ok) return { google: false, apple: false };
    return res.json();
  } catch {
    return { google: false, apple: false };
  }
}

export async function loginWithSocialToken(
  provider: 'google' | 'apple',
  token: string,
  name?: string,
  tokenType: 'idToken' | 'accessToken' = 'idToken'
): Promise<AuthResponse> {
  const body: Record<string, string | undefined> = { name };
  if (tokenType === 'accessToken') {
    body.accessToken = token;
  } else {
    body.idToken = token;
  }
  const res = await fetch(`${API_BASE}/auth/${provider}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Social login failed');
  }
  const data: AuthResponse = await res.json();
  await storeTokens(data.accessToken, data.refreshToken);
  return data;
}
