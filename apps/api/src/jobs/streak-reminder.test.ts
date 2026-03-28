import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(() => ({ stop: vi.fn() })) },
}));

// Mock logger
vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock push-sender
const mockSendPushToUser = vi.fn();
vi.mock('../services/push-sender', () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
}));

// Mock @sportykids/shared
vi.mock('@sportykids/shared', () => ({
  t: vi.fn((key: string) => key),
}));

// Mock prisma
const mockFindManyUser = vi.fn();
vi.mock('../config/database', () => ({
  prisma: {
    user: { findMany: (...args: unknown[]) => mockFindManyUser(...args) },
  },
}));

import { sendStreakReminders } from './streak-reminder';

describe('streak-reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send reminders to users with active streaks who have not checked in', async () => {
    mockFindManyUser.mockResolvedValue([
      { id: 'u1', currentStreak: 5, locale: 'es' },
      { id: 'u2', currentStreak: 10, locale: 'en' },
    ]);
    mockSendPushToUser.mockResolvedValue(undefined);

    const result = await sendStreakReminders();

    expect(result.sent).toBe(2);
    expect(mockSendPushToUser).toHaveBeenCalledTimes(2);
  });

  it('should return zero when no at-risk users found', async () => {
    mockFindManyUser.mockResolvedValue([]);

    const result = await sendStreakReminders();

    expect(result.sent).toBe(0);
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it('should handle push notification failures gracefully', async () => {
    mockFindManyUser.mockResolvedValue([
      { id: 'u1', currentStreak: 7, locale: 'es' },
    ]);
    mockSendPushToUser.mockRejectedValue(new Error('Push failed'));

    const result = await sendStreakReminders();

    // Error is caught, sent count stays 0
    expect(result.sent).toBe(0);
  });

  it('should use user locale for push messages', async () => {
    mockFindManyUser.mockResolvedValue([
      { id: 'u1', currentStreak: 3, locale: 'en' },
    ]);
    mockSendPushToUser.mockResolvedValue(undefined);

    await sendStreakReminders();

    // The t() mock is called with 'en' locale
    const { t } = await import('@sportykids/shared');
    expect(t).toHaveBeenCalledWith('push.streak_warning_title', 'en');
    expect(t).toHaveBeenCalledWith('push.streak_warning_body', 'en');
  });
});
