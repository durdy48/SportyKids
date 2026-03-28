import { ColorSchemeName } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  blue: string;
  green: string;
  yellow: string;
}

export const lightColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#1E293B',
  muted: '#6B7280',
  border: '#E5E7EB',
  blue: '#2563EB',
  green: '#22C55E',
  yellow: '#FACC15',
};

export const darkColors: ThemeColors = {
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  muted: '#94A3B8',
  border: '#334155',
  blue: '#3B82F6',
  green: '#34D399',
  yellow: '#FCD34D',
};

export function resolveTheme(mode: ThemeMode, systemScheme: ColorSchemeName): ResolvedTheme {
  if (mode === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return mode;
}

export function resolveColors(mode: ThemeMode, systemScheme: ColorSchemeName): ThemeColors {
  const resolved = resolveTheme(mode, systemScheme);
  return resolved === 'dark' ? darkColors : lightColors;
}
