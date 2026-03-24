// Shared types between API, web and mobile

export interface PushPreferences {
  sports: string[];
  dailyQuiz: boolean;
  teamUpdates: boolean;
}

export interface User {
  id: string;
  name: string;
  age: number;
  favoriteSports: string[];
  favoriteTeam?: string;
  selectedFeeds: string[];
  totalPoints?: number;
  pushEnabled?: boolean;
  pushPreferences?: PushPreferences;
  createdAt: Date;
}

export type SafetyStatus = 'pending' | 'approved' | 'rejected';

export interface SafetyResult {
  status: 'approved' | 'rejected';
  reason?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  imageUrl: string;
  source: string;
  sourceUrl: string;
  sport: string;
  team?: string;
  minAge: number;
  maxAge: number;
  publishedAt: Date;
  safetyStatus?: SafetyStatus;
  safetyReason?: string;
  moderatedAt?: string;
  summaries?: NewsSummary[];
}

export interface Reel {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  source: string;
  sport: string;
  team?: string;
  minAge: number;
  maxAge: number;
  durationSeconds: number;
  videoType?: string;
  aspectRatio?: string;
  previewGifUrl?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  sport: string;
  points: number;
  relatedNewsId?: string;
  generatedAt?: string;
  ageRange?: string;
  expiresAt?: string;
  isDaily?: boolean;
}

export interface ParentalProfile {
  userId: string;
  allowedSports: string[];
  allowedFeeds: string[];
  allowedFormats: ('news' | 'reels' | 'quiz')[];
  maxDailyTimeMinutes?: number;
}

export type AgeRange = '6-8' | '9-11' | '12-14';

export interface RssSource {
  id: string;
  name: string;
  url: string;
  sport: string;
  active: boolean;
  lastSyncedAt?: string;
  country: string;
  language: string;
  logoUrl?: string;
  description: string;
  category: 'general' | 'team' | 'league' | 'youth';
  isCustom: boolean;
  addedBy?: string;
}

export interface RssSourceCatalogResponse {
  sources: RssSource[];
  total: number;
  bySport: Record<string, number>;
}

export interface NewsSummary {
  id: string;
  newsItemId: string;
  ageRange: string;
  summary: string;
  locale: string;
  createdAt: string;
}

// Gamification types

export type StickerRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Sticker {
  id: string;
  name: string;
  nameKey: string;
  imageUrl: string;
  sport: string;
  team: string | null;
  rarity: StickerRarity;
}

export interface UserSticker {
  id: string;
  stickerId: string;
  source: string;
  obtainedAt: string;
  sticker: Sticker;
}

export interface Achievement {
  id: string;
  key: string;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  threshold: number;
  type: string;
  rewardStickerId?: string;
}

export interface UserAchievement {
  id: string;
  achievementId: string;
  unlockedAt: string;
  achievement: Achievement;
}

export interface RecentResult {
  opponent: string;
  score: string;
  result: 'W' | 'D' | 'L';
  date: string;
}

export interface NextMatch {
  opponent: string;
  date: string;
  competition: string;
}

export interface TeamStats {
  id: string;
  teamName: string;
  sport: string;
  leaguePosition?: number;
  recentResults: RecentResult[];
  topScorer?: string;
  nextMatch?: NextMatch;
  updatedAt: string;
}

export interface CheckInResponse {
  currentStreak: number;
  longestStreak: number;
  streakBroken: boolean;
  dailyStickerAwarded: { id: string; name: string; rarity: string } | null;
  pointsAwarded: number;
  newAchievements: Array<{ key: string; nameKey: string; icon: string }>;
}
