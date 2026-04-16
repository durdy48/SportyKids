import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(() => ({ stop: vi.fn() })) },
}));

// Mock logger
vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock mission-generator
const mockGenerateDailyMissionBatched = vi.fn();
vi.mock('../services/mission-generator', () => ({
  generateDailyMissionBatched: (...args: unknown[]) => mockGenerateDailyMissionBatched(...args),
}));

// Mock push-sender
const mockSendPushToUser = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/push-sender', () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
}));

// Mock @sportykids/shared
const mockT = vi.fn((key: string, locale: string) => `${key}[${locale}]`);
vi.mock('@sportykids/shared', () => ({
  t: (...args: unknown[]) => mockT(...(args as [string, string])),
}));

// Mock prisma
const mockPrisma = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  dailyMission: { findMany: vi.fn() },
  parentalProfile: { findMany: vi.fn() },
}));
vi.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

import { generateDailyMissions } from './generate-daily-missions';

const makeUser = (id: string, overrides = {}) => ({
  id,
  locale: 'es',
  age: 10,
  favoriteSports: ['football'],
  ...overrides,
});

describe('generate-daily-missions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing missions, no parental profiles
    mockPrisma.dailyMission.findMany.mockResolvedValue([]);
    mockPrisma.parentalProfile.findMany.mockResolvedValue([]);
  });

  it('should generate missions for all active users with no existing missions', async () => {
    mockPrisma.user.findMany.mockResolvedValue([makeUser('u1'), makeUser('u2'), makeUser('u3')]);
    mockGenerateDailyMissionBatched.mockResolvedValue({ rewardRarity: 'rare' });

    const result = await generateDailyMissions();

    expect(result.generated).toBe(3);
    expect(result.errors).toBe(0);
    expect(mockGenerateDailyMissionBatched).toHaveBeenCalledTimes(3);
  });

  it('should return zero when no active users found', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await generateDailyMissions();

    expect(result.generated).toBe(0);
    expect(result.errors).toBe(0);
    expect(mockGenerateDailyMissionBatched).not.toHaveBeenCalled();
  });

  it('should skip users that already have a mission today', async () => {
    mockPrisma.user.findMany.mockResolvedValue([makeUser('u1'), makeUser('u2')]);
    mockPrisma.dailyMission.findMany.mockResolvedValue([{ userId: 'u1' }]);
    mockGenerateDailyMissionBatched.mockResolvedValue({ rewardRarity: 'common' });

    const result = await generateDailyMissions();

    // u1 already had a mission (counted as generated), u2 gets generated
    expect(result.generated).toBe(2);
    expect(result.errors).toBe(0);
    expect(mockGenerateDailyMissionBatched).toHaveBeenCalledTimes(1);
    expect(mockGenerateDailyMissionBatched).toHaveBeenCalledWith('u2', expect.any(Object), 'es');
  });

  it('should count errors when mission generation fails for a user', async () => {
    mockPrisma.user.findMany.mockResolvedValue([makeUser('u1'), makeUser('u2')]);
    mockGenerateDailyMissionBatched
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ rewardRarity: 'common' });

    const result = await generateDailyMissions();

    expect(result.generated).toBe(1);
    expect(result.errors).toBe(1);
  });

  it('should send push notification when mission is generated', async () => {
    mockPrisma.user.findMany.mockResolvedValue([makeUser('u1', { locale: 'es' })]);
    mockGenerateDailyMissionBatched.mockResolvedValue({ rewardRarity: 'epic' });

    await generateDailyMissions();

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ data: { screen: 'HomeFeed' } }),
    );
  });

  it('should use user locale for push notification text', async () => {
    mockPrisma.user.findMany.mockResolvedValue([makeUser('u1', { locale: 'en' })]);
    mockGenerateDailyMissionBatched.mockResolvedValue({ rewardRarity: 'rare' });

    await generateDailyMissions();

    expect(mockT).toHaveBeenCalledWith('push.mission_ready_title', 'en');
    expect(mockT).toHaveBeenCalledWith('push.mission_ready_body', 'en');
  });

  it('should use Spanish locale for push notification when user has locale es', async () => {
    mockPrisma.user.findMany.mockResolvedValue([makeUser('u1', { locale: 'es' })]);
    mockGenerateDailyMissionBatched.mockResolvedValue({ rewardRarity: 'common' });

    await generateDailyMissions();

    expect(mockT).toHaveBeenCalledWith('push.mission_ready_title', 'es');
    expect(mockT).toHaveBeenCalledWith('push.mission_ready_body', 'es');
  });

  it('should default to es locale when user has no locale set', async () => {
    mockPrisma.user.findMany.mockResolvedValue([makeUser('u1', { locale: null })]);
    mockGenerateDailyMissionBatched.mockResolvedValue({ rewardRarity: 'common' });

    await generateDailyMissions();

    expect(mockT).toHaveBeenCalledWith('push.mission_ready_title', 'es');
    expect(mockT).toHaveBeenCalledWith('push.mission_ready_body', 'es');
  });

  it('should pass parental allowedFormats from pre-fetched profile', async () => {
    mockPrisma.user.findMany.mockResolvedValue([makeUser('u1')]);
    mockPrisma.parentalProfile.findMany.mockResolvedValue([
      { userId: 'u1', allowedFormats: ['news'] },
    ]);
    mockGenerateDailyMissionBatched.mockResolvedValue({ rewardRarity: 'common' });

    await generateDailyMissions();

    expect(mockGenerateDailyMissionBatched).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ allowedFormats: ['news'] }),
      'es',
    );
  });

  it('should use default allowedFormats when no parental profile exists', async () => {
    mockPrisma.user.findMany.mockResolvedValue([makeUser('u1')]);
    mockPrisma.parentalProfile.findMany.mockResolvedValue([]);
    mockGenerateDailyMissionBatched.mockResolvedValue({ rewardRarity: 'common' });

    await generateDailyMissions();

    expect(mockGenerateDailyMissionBatched).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ allowedFormats: ['news', 'reels', 'quiz'] }),
      'es',
    );
  });
});
