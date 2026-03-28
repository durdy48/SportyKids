import type { AuthResponse, LoginRequest, RegisterRequest } from '@sportykids/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
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
  storeTokens(result.accessToken, result.refreshToken);
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
  storeTokens(result.accessToken, result.refreshToken);
  return result;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function refreshToken(): Promise<string | null> {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
  if (!stored) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const result = await res.json();
    storeTokens(result.accessToken, result.refreshToken);
    return result.accessToken;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
  if (stored) {
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored }),
    }).catch(() => {});
  }
  clearTokens();
}

function storeTokens(accessToken: string, refreshTokenValue: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshTokenValue);
}

function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export function getGoogleLoginUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  return `${apiUrl}/auth/google`;
}

export function getAppleLoginUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  return `${apiUrl}/auth/apple`;
}
