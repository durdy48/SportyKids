import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../config/database', () => ({
  prisma: {
    dailyMission: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

// Mock push sender
vi.mock('../services/push-sender', () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock('../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { sendMissionReminders } from './mission-reminder';
import { prisma } from '../config/database';
import { sendPushToUser } from '../services/push-sender';

describe('sendMissionReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends reminders to users with >50% progress', async () => {
    const mockMissions = [
      { id: 'm1', userId: 'u1', target: 4, progress: 3, completed: false }, // 75% - should send
      { id: 'm2', userId: 'u2', target: 5, progress: 1, completed: false }, // 20% - should not send
      { id: 'm3', userId: 'u3', target: 3, progress: 2, completed: false }, // 67% - should send
    ];
    const mockUsers = [
      { id: 'u1', locale: 'es' },
      { id: 'u2', locale: 'en' },
      { id: 'u3', locale: 'en' },
    ];

    (prisma.dailyMission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockMissions);
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockUsers);

    const result = await sendMissionReminders();

    expect(result.sent).toBe(2);
    expect(result.errors).toBe(0);
    expect(sendPushToUser).toHaveBeenCalledTimes(2);
    expect(sendPushToUser).toHaveBeenCalledWith('u1', expect.objectContaining({
      data: { screen: 'HomeFeed' },
    }));
    expect(sendPushToUser).toHaveBeenCalledWith('u3', expect.objectContaining({
      data: { screen: 'HomeFeed' },
    }));
  });

  it('does not send to users with 0 progress', async () => {
    (prisma.dailyMission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'm1', userId: 'u1', target: 3, progress: 0, completed: false },
    ]);
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'u1', locale: 'es' },
    ]);

    const result = await sendMissionReminders();
    expect(result.sent).toBe(0);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('handles empty mission list', async () => {
    (prisma.dailyMission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await sendMissionReminders();
    expect(result.sent).toBe(0);
    expect(result.errors).toBe(0);
  });
});
