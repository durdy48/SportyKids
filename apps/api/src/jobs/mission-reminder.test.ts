import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../config/database', () => ({
  prisma: {
    dailyMission: {
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
      {
        id: 'm1',
        userId: 'u1',
        target: 4,
        progress: 3, // 75% - should send
        completed: false,
        user: { id: 'u1', locale: 'es' },
      },
      {
        id: 'm2',
        userId: 'u2',
        target: 5,
        progress: 1, // 20% - should not send
        completed: false,
        user: { id: 'u2', locale: 'en' },
      },
      {
        id: 'm3',
        userId: 'u3',
        target: 3,
        progress: 2, // 67% - should send
        completed: false,
        user: { id: 'u3', locale: 'en' },
      },
    ];

    (prisma.dailyMission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockMissions);

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
      {
        id: 'm1',
        userId: 'u1',
        target: 3,
        progress: 0,
        completed: false,
        user: { id: 'u1', locale: 'es' },
      },
    ]);

    const result = await sendMissionReminders();
    expect(result.sent).toBe(0);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('handles empty mission list', async () => {
    (prisma.dailyMission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await sendMissionReminders();
    expect(result.sent).toBe(0);
    expect(result.errors).toBe(0);
  });
});
