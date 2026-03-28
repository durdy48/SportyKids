import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@sportykids/shared';
import { API_BASE } from '../config';

const ACCESS_TOKEN_KEY = 'sportykids_access_token';
const REFRESH_TOKEN_KEY = 'sportykids_refresh_token';

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
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function refreshToken(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
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
  const stored = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
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
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshTokenValue);
}

async function clearTokens(): Promise<void> {
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
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
  idToken: string,
  name?: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/${provider}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Social login failed');
  }
  const data: AuthResponse = await res.json();
  await storeTokens(data.accessToken, data.refreshToken);
  return data;
}

