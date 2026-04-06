import Constants from 'expo-constants';

const ENV_MAP: Record<string, string> = {
  production: 'https://sportykids-api.fly.dev/api',
  preview: 'https://sportykids-api.fly.dev/api',
};

export function resolveApiBase(): string {
  // 1. Explicit env var override (highest priority)
  const envOverride = process.env.EXPO_PUBLIC_API_BASE;
  if (envOverride) return envOverride;

  // 2. EAS channel-based detection
  // Cast: Expo SDK types don't include `channel` on the updates config,
  // but EAS sets it at build time. Safe to read as unknown.
  const updates = Constants.expoConfig?.updates as Record<string, unknown> | undefined;
  const channel =
    Constants.expoConfig?.extra?.eas?.channel ??
    updates?.channel ??
    undefined;

  if (channel && ENV_MAP[channel]) {
    return ENV_MAP[channel];
  }

  // 3. Local dev — use Expo debugger host IP (only present when Metro is running)
  const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (debuggerHost) {
    return `http://${debuggerHost}:3001/api`;
  }

  // 4. Default to production — covers EAS Updates loaded in Expo Go without channel metadata
  return 'https://sportykids-api.fly.dev/api';
}

export const API_BASE = resolveApiBase();

const WEB_ENV_MAP: Record<string, string> = {
  production: 'https://sportykids.app',
  preview: 'https://staging.sportykids.app',
};

function resolveWebBase(): string {
  const updates = Constants.expoConfig?.updates as Record<string, unknown> | undefined;
  const channel =
    Constants.expoConfig?.extra?.eas?.channel ??
    updates?.channel ??
    undefined;

  if (channel && WEB_ENV_MAP[channel]) {
    return WEB_ENV_MAP[channel];
  }

  const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (debuggerHost) {
    return `http://${debuggerHost}:3000`;
  }

  return 'https://sportykids.app';
}

export const WEB_BASE = resolveWebBase();

// Google Sign In — iOS OAuth Client ID (created in Google Cloud Console, type: iOS)
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

// Google Sign In — Web Client ID for Expo Go proxy (created in Google Cloud Console, type: Web)
// Authorized redirect URI must include: https://auth.expo.io/@sportykids-app/sportykids
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
