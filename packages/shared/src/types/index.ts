// Shared types between API, web and mobile

export interface LiveScorePreferences {
  enabled: boolean;
  goals: boolean;
  matchStart: boolean;
  matchEnd: boolean;
  halfTime: boolean;
  redCards: boolean;
}

export interface PushPreferences {
  sports: boolean;
  dailyQuiz: boolean;
  teamUpdates: boolean;
  liveScores?: LiveScorePreferences;
}

export type LiveMatchStatus = 'not_started' | 'live' | 'half_time' | 'finished';

export type MatchEventType = 'goal' | 'match_start' | 'match_end' | 'red_card' | 'half_time';

export interface MatchEvent {
  type: MatchEventType;
  team: string;
  detail?: string;
  homeScore: number;
  awayScore: number;
}

export interface LiveMatchData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  progress: string;
  status: LiveMatchStatus;
  league: string;
  sport: string;
  matchDate: string;
}

export interface User {
  id: string;
  name: string;
  age: number;
  email?: string;
  authProvider?: string;
  socialId?: string;
  role?: 'child' | 'parent' | 'admin';
  parentUserId?: string;
  favoriteSports: string[];
  favoriteTeam?: string;
  selectedFeeds: string[];
  totalPoints?: number;
  pushEnabled?: boolean;
  pushPreferences?: PushPreferences;
  locale?: string;
  country?: string;
  ageGateCompleted?: boolean;
  consentGiven?: boolean;
  consentDate?: string | null;
  consentBy?: string | null;
  subscriptionTier?: SubscriptionTier;
  subscriptionExpiry?: string | null;
  organizationId?: string | null;
  organizationRole?: OrganizationRole | null;
  createdAt: Date;
}

/**
 * Authentication provider type.
 * - anonymous: auto-created user without credentials
 * - email: email + password authentication
 * - google: Google OAuth 2.0 (planned)
 * - apple: Apple Sign In (planned)
 */
export type AuthProvider = 'anonymous' | 'email' | 'google' | 'apple';

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

export interface SocialAuthRequest {
  idToken: string;
  provider: 'google' | 'apple';
  name?: string;
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
  rssGuid?: string;
  videoSourceId?: string;
  safetyStatus?: SafetyStatus;
  safetyReason?: string;
  moderatedAt?: string;
  publishedAt?: string;
}

export type VideoPlatform = 'youtube_channel' | 'youtube_playlist' | 'instagram_account' | 'tiktok_account' | 'manual';

export interface VideoSource {
  id: string;
  name: string;
  platform: VideoPlatform;
  feedUrl: string;
  channelId?: string;
  playlistId?: string;
  sport: string;
  active: boolean;
  isCustom: boolean;
  addedBy?: string;
  lastSyncedAt?: string;
  createdAt?: string;
}

export interface VideoSourceCatalogResponse {
  sources: VideoSource[];
  total: number;
  bySport: Record<string, number>;
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

// Subscription types

export type SubscriptionTier = 'free' | 'premium';

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  expiry: string | null;
  limits: {
    newsPerDay: number | null;       // null = unlimited
    reelsPerDay: number | null;
    quizPerDay: number | null;
    sportsAllowed: string[] | null;  // null = all
  };
  usage: {
    newsToday: number;
    reelsToday: number;
    quizToday: number;
  };
  canUpgrade: boolean;
  familyPlan: boolean;
  childCount: number;
}

export interface CheckInResponse {
  currentStreak: number;
  longestStreak: number;
  streakBroken: boolean;
  dailyStickerAwarded: { id: string; name: string; rarity: string } | null;
  pointsAwarded: number;
  newAchievements: Array<{ key: string; nameKey: string; icon: string }>;
}

// Organization types (B2B)

export type OrganizationRole = 'member' | 'admin';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  sport: string;
  logoUrl?: string | null;
  customColors?: { primary: string; secondary: string } | null;
  inviteCode: string;
  maxMembers: number;
  active: boolean;
  createdBy: string;
  memberCount?: number;
  createdAt?: string;
}

export interface OrganizationMember {
  id: string;
  name: string;
  age: number;
  totalPoints: number;
  currentStreak: number;
  lastActiveDate: string | null;
  joinedAt: string;
}

export interface OrganizationActivity {
  period: string;
  summary: {
    totalMembers: number;
    activeMembers: number;
    totalNewsRead: number;
    totalReelsWatched: number;
    totalQuizAnswered: number;
    averageStreak: number;
    averagePoints: number;
  };
  daily: Array<{
    date: string;
    activeMembers: number;
    newsRead: number;
    reelsWatched: number;
    quizAnswered: number;
  }>;
  topMembers: Array<{
    name: string;
    points: number;
    streak: number;
  }>;
}

export interface JoinOrganizationResponse {
  organizationId: string;
  organizationName: string;
  sport: string;
  message: string;
}
