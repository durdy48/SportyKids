// Environment-aware API configuration
// Currently uses a manual switch between dev/preview/production.
// TODO: Replace with expo-constants dynamic detection using
// Constants.expoConfig?.extra?.eas?.channel to automatically select
// the correct environment (e.g., 'preview' -> staging, 'production' -> prod).
const ENV = {
  dev: 'http://192.168.1.147:3001/api',
  preview: 'https://api-staging.sportykids.app/api',
  production: 'https://api.sportykids.app/api',
};

export const API_BASE = ENV.dev;

const WEB_ENV = {
  dev: 'http://192.168.1.147:3000',
  preview: 'https://staging.sportykids.app',
  production: 'https://sportykids.app',
};

export const WEB_BASE = WEB_ENV.dev;
