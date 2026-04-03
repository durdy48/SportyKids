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

export type EntityType =
  | 'team'
  | 'athlete'
  | 'driver'
  | 'cyclist'
  | 'swimmer'
  | 'padel_player';

export interface SportEntity {
  name: string;
  type: EntityType;
  feedQuery: string;
}

export const SPORT_ENTITIES: Record<string, SportEntity[]> = {
  football: [
    { name: 'Real Madrid',          type: 'team',    feedQuery: 'Google News: Real Madrid' },
    { name: 'FC Barcelona',         type: 'team',    feedQuery: 'Google News: FC Barcelona' },
    { name: 'Atlético de Madrid',   type: 'team',    feedQuery: 'Google News: Atletico de Madrid' },
    { name: 'Athletic Club',        type: 'team',    feedQuery: 'Google News: Athletic Club' },
    { name: 'Real Sociedad',        type: 'team',    feedQuery: 'Google News: Real Sociedad' },
    { name: 'Real Betis',           type: 'team',    feedQuery: 'Google News: Real Betis' },
    { name: 'Sevilla FC',           type: 'team',    feedQuery: 'Google News: Sevilla FC' },
    { name: 'Valencia CF',          type: 'team',    feedQuery: 'Google News: Valencia CF' },
    { name: 'Villarreal',           type: 'team',    feedQuery: 'Google News: Villarreal' },
    { name: 'Manchester City',      type: 'team',    feedQuery: 'Google News: Manchester City' },
    { name: 'Liverpool',            type: 'team',    feedQuery: 'Google News: Liverpool FC' },
    { name: 'Bayern Munich',        type: 'team',    feedQuery: 'Google News: Bayern Munich' },
    { name: 'PSG',                  type: 'team',    feedQuery: 'Google News: PSG' },
    { name: 'Juventus',             type: 'team',    feedQuery: 'Google News: Juventus' },
    { name: 'Inter Milan',          type: 'team',    feedQuery: 'Google News: Inter Milan' },
    { name: 'Spain National Team',  type: 'team',    feedQuery: 'Google News: Seleccion Espanola' },
  ],
  basketball: [
    { name: 'Los Angeles Lakers',     type: 'team', feedQuery: 'Google News: LA Lakers' },
    { name: 'Golden State Warriors',  type: 'team', feedQuery: 'Google News: Golden State Warriors' },
    { name: 'Boston Celtics',         type: 'team', feedQuery: 'Google News: Boston Celtics' },
    { name: 'Miami Heat',             type: 'team', feedQuery: 'Google News: Miami Heat' },
    { name: 'Real Madrid Basket',     type: 'team', feedQuery: 'Google News: Real Madrid Basket' },
    { name: 'FC Barcelona Basket',    type: 'team', feedQuery: 'Google News: Barcelona Basket' },
    { name: 'Unicaja',                type: 'team', feedQuery: 'Google News: Unicaja' },
    { name: 'Baskonia',               type: 'team', feedQuery: 'Google News: Baskonia' },
  ],
  tennis: [
    { name: 'Carlos Alcaraz',   type: 'athlete', feedQuery: 'Google News: Carlos Alcaraz' },
    { name: 'Rafa Nadal',       type: 'athlete', feedQuery: 'Google News: Rafael Nadal' },
    { name: 'Novak Djokovic',   type: 'athlete', feedQuery: 'Google News: Novak Djokovic' },
    { name: 'Jannik Sinner',    type: 'athlete', feedQuery: 'Google News: Jannik Sinner' },
    { name: 'Iga Swiatek',      type: 'athlete', feedQuery: 'Google News: Iga Swiatek' },
    { name: 'Aryna Sabalenka',  type: 'athlete', feedQuery: 'Google News: Aryna Sabalenka' },
  ],
  formula1: [
    { name: 'Max Verstappen',   type: 'driver', feedQuery: 'Google News: Max Verstappen' },
    { name: 'Lewis Hamilton',   type: 'driver', feedQuery: 'Google News: Lewis Hamilton' },
    { name: 'Charles Leclerc', type: 'driver', feedQuery: 'Google News: Charles Leclerc' },
    { name: 'Carlos Sainz',     type: 'driver', feedQuery: 'Google News: Carlos Sainz F1' },
    { name: 'Fernando Alonso',  type: 'driver', feedQuery: 'Google News: Fernando Alonso' },
    { name: 'Lando Norris',     type: 'driver', feedQuery: 'Google News: Lando Norris' },
    { name: 'Red Bull Racing',  type: 'team',   feedQuery: 'Google News: Red Bull Racing' },
    { name: 'Ferrari',          type: 'team',   feedQuery: 'Google News: Ferrari F1' },
    { name: 'Mercedes',         type: 'team',   feedQuery: 'Google News: Mercedes F1' },
    { name: 'McLaren',          type: 'team',   feedQuery: 'Google News: McLaren F1' },
  ],
  cycling: [
    { name: 'Tadej Pogacar',      type: 'cyclist', feedQuery: 'Google News: Tadej Pogacar' },
    { name: 'Jonas Vingegaard',   type: 'cyclist', feedQuery: 'Google News: Jonas Vingegaard' },
    { name: 'Remco Evenepoel',    type: 'cyclist', feedQuery: 'Google News: Remco Evenepoel' },
    { name: 'Primoz Roglic',      type: 'cyclist', feedQuery: 'Google News: Primoz Roglic' },
  ],
  swimming: [
    { name: 'Caeleb Dressel',  type: 'swimmer', feedQuery: 'Google News: Caeleb Dressel' },
    { name: 'Léon Marchand',   type: 'swimmer', feedQuery: 'Google News: Leon Marchand' },
    { name: 'Katie Ledecky',   type: 'swimmer', feedQuery: 'Google News: Katie Ledecky' },
  ],
  athletics: [
    { name: 'Mondo Duplantis',    type: 'athlete', feedQuery: 'Google News: Mondo Duplantis' },
    { name: 'Noah Lyles',         type: 'athlete', feedQuery: 'Google News: Noah Lyles' },
    { name: 'Sydney McLaughlin',  type: 'athlete', feedQuery: 'Google News: Sydney McLaughlin' },
  ],
  padel: [
    { name: 'Alejandro Galán', type: 'padel_player', feedQuery: 'Google News: Alejandro Galan' },
    { name: 'Arturo Coello',   type: 'padel_player', feedQuery: 'Google News: Arturo Coello' },
  ],
};
