// Shared types between API, web and mobile

export interface User {
  id: string;
  name: string;
  age: number;
  favoriteSports: string[];
  favoriteTeam?: string;
  selectedFeeds: string[];
  totalPoints?: number;
  createdAt: Date;
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
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  sport: string;
  points: number;
  relatedNewsId?: string;
}

export interface ParentalProfile {
  userId: string;
  allowedSports: string[];
  allowedFeeds: string[];
  allowedFormats: ('news' | 'reels' | 'quiz')[];
  maxDailyTimeMinutes?: number;
}

export type AgeRange = '6-8' | '9-11' | '12-14';
