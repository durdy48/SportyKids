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
const mockGenerateDailyMission = vi.fn();
vi.mock('../services/mission-generator', () => ({
  generateDailyMission: (...args: unknown[]) => mockGenerateDailyMission(...args),
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
const mockFindManyUser = vi.fn();
vi.mock('../config/database', () => ({
  prisma: {
    user: { findMany: (...args: unknown[]) => mockFindManyUser(...args) },
  },
}));

import { generateDailyMissions } from './generate-daily-missions';

describe('generate-daily-missions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate missions for all active users', async () => {
    mockFindManyUser.mockResolvedValue([
      { id: 'u1' },
      { id: 'u2' },
      { id: 'u3' },
    ]);
    mockGenerateDailyMission.mockResolvedValue({ rewardRarity: 'rare' });

    const result = await generateDailyMissions();

    expect(result.generated).toBe(3);
    expect(result.errors).toBe(0);
    expect(mockGenerateDailyMission).toHaveBeenCalledTimes(3);
  });

  it('should return zero when no active users found', async () => {
    mockFindManyUser.mockResolvedValue([]);

    const result = await generateDailyMissions();

    expect(result.generated).toBe(0);
    expect(result.errors).toBe(0);
    expect(mockGenerateDailyMission).not.toHaveBeenCalled();
  });

  it('should count errors when mission generation fails for a user', async () => {
    mockFindManyUser.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    mockGenerateDailyMission
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ rewardRarity: 'common' });

    const result = await generateDailyMissions();

    expect(result.generated).toBe(1);
    expect(result.errors).toBe(1);
  });

  it('should send push notification when mission is generated', async () => {
    mockFindManyUser.mockResolvedValue([{ id: 'u1', locale: 'es' }]);
    mockGenerateDailyMission.mockResolvedValue({ rewardRarity: 'epic' });

    await generateDailyMissions();

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ data: { screen: 'HomeFeed' } }),
    );
  });

  it('should use user locale for push notification text', async () => {
    mockFindManyUser.mockResolvedValue([{ id: 'u1', locale: 'en' }]);
    mockGenerateDailyMission.mockResolvedValue({ rewardRarity: 'rare' });

    await generateDailyMissions();

    expect(mockT).toHaveBeenCalledWith('push.mission_ready_title', 'en');
    expect(mockT).toHaveBeenCalledWith('push.mission_ready_body', 'en');
  });

  it('should use Spanish locale for push notification when user has locale es', async () => {
    mockFindManyUser.mockResolvedValue([{ id: 'u1', locale: 'es' }]);
    mockGenerateDailyMission.mockResolvedValue({ rewardRarity: 'common' });

    await generateDailyMissions();

    expect(mockT).toHaveBeenCalledWith('push.mission_ready_title', 'es');
    expect(mockT).toHaveBeenCalledWith('push.mission_ready_body', 'es');
  });

  it('should default to es locale when user has no locale set', async () => {
    mockFindManyUser.mockResolvedValue([{ id: 'u1', locale: null }]);
    mockGenerateDailyMission.mockResolvedValue({ rewardRarity: 'common' });

    await generateDailyMissions();

    expect(mockT).toHaveBeenCalledWith('push.mission_ready_title', 'es');
    expect(mockT).toHaveBeenCalledWith('push.mission_ready_body', 'es');
  });
});
