// Shared constants
export { KID_FRIENDLY_ERRORS, ERROR_CODES, getErrorType } from './errors';
export type { KidFriendlyError, ErrorCode } from './errors';
export { SUPPORTED_LOCALES, SUPPORTED_COUNTRIES, inferCountryFromLocale } from './locale';
export type { SupportedLocale, SupportedCountry } from './locale';

export const SPORTS = [
  'football',
  'basketball',
  'tennis',
  'swimming',
  'athletics',
  'cycling',
  'formula1',
  'padel',
] as const;

export type Sport = (typeof SPORTS)[number];

export const AGE_RANGES = {
  '6-8': { min: 6, max: 8, label: '6-8' },
  '9-11': { min: 9, max: 11, label: '9-11' },
  '12-14': { min: 12, max: 14, label: '12-14' },
} as const;

export const TEAMS = [
  // Football - Spain
  'Real Madrid',
  'Barcelona',
  'Atlético de Madrid',
  'Athletic Club',
  'Real Sociedad',
  'Real Betis',
  'Sevilla FC',
  'Valencia CF',
  'Villarreal',
  // Football - International
  'Manchester City',
  'Liverpool',
  'Bayern Munich',
  'PSG',
  'Juventus',
  'Inter Milan',
  // National Teams
  'Spain National Team',
  // Individual Athletes
  'Carlos Alcaraz',
  'Rafa Nadal',
  'Fernando Alonso',
  'Carlos Sainz',
] as const;

export type Team = (typeof TEAMS)[number];

export const COLORS = {
  blue: '#2563EB',
  green: '#22C55E',
  yellow: '#FACC15',
  white: '#FFFFFF',
  lightBackground: '#F8FAFC',
  darkText: '#1E293B',
} as const;

export const FREE_TIER_LIMITS = {
  newsPerDay: 5,
  reelsPerDay: 5,
  quizPerDay: 3,
  maxSports: 1,
} as const;

export const PREMIUM_PRICE = {
  monthly: { amount: 2.99, currency: 'EUR' },
  yearly: { amount: 24.99, currency: 'EUR' },
} as const;

export const FAMILY_PLAN_MAX_CHILDREN = 3;

export const STICKER_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

export const RARITY_COLORS: Record<string, string> = {
  common: '#94A3B8',
  rare: '#2563EB',
  epic: '#9333EA',
  legendary: '#F59E0B',
};
