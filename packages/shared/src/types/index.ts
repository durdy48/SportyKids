// Shared types between API, web and mobile

export interface PushPreferences {
  sports: boolean;
  dailyQuiz: boolean;
  teamUpdates: boolean;
}

export interface User {
  id: string;
  name: string;
  age: number;
  email?: string;
  authProvider?: string;
  role?: 'child' | 'parent';
  parentUserId?: string;
  favoriteSports: string[];
  favoriteTeam?: string;
  selectedFeeds: string[];
  totalPoints?: number;
  pushEnabled?: boolean;
  pushPreferences?: PushPreferences;
  createdAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  name: string;
  age?: number;
  role?: 'child' | 'parent';
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
  maxNewsMinutes?: number | null;
  maxReelsMinutes?: number | null;
  maxQuizMinutes?: number | null;
  digestEnabled?: boolean;
  digestEmail?: string | null;
  digestDay?: number;
  lastDigestSentAt?: string;
  allowedHoursStart?: number;
  allowedHoursEnd?: number;
  timezone?: string;
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

// Content reporting types

export type ReportReason = 'inappropriate' | 'scary' | 'confusing' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned';

export interface ContentReport {
  id: string;
  userId: string;
  contentType: 'news' | 'reel';
  contentId: string;
  reason: ReportReason;
  comment?: string;
  status: ReportStatus;
  reviewedAt?: string;
  createdAt: string;
}

export interface DailyMission {
  id: string;
  userId: string;
  date: string;
  type: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  completedAt?: string;
  rewardType: string;
  rewardRarity?: string;
  rewardPoints: number;
  claimed: boolean;
  claimedAt?: string;
}

export interface CheckInResponse {
  currentStreak: number;
  longestStreak: number;
  streakBroken: boolean;
  dailyStickerAwarded: { id: string; name: string; rarity: string } | null;
  pointsAwarded: number;
  newAchievements: Array<{ key: string; nameKey: string; icon: string }>;
}
