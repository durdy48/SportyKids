import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Expo SDK
const mockSendPushNotificationsAsync = vi.fn();
const mockChunkPushNotifications = vi.fn((messages: unknown[]) => [messages]);

class MockExpo {
  sendPushNotificationsAsync = mockSendPushNotificationsAsync;
  chunkPushNotifications = mockChunkPushNotifications;
  static isExpoPushToken(token: string): boolean {
    return typeof token === 'string' && token.startsWith('ExponentPushToken[');
  }
}

vi.mock('expo-server-sdk', () => ({
  Expo: MockExpo,
}));

// Mock Prisma
vi.mock('../config/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    pushToken: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    pushToken: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

const { prisma } = await import('../config/database');
const { sendPushToUser, sendPushToUsers } = await import('./push-sender');

describe('push-sender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendPushToUser', () => {
    it('should not send if user has pushEnabled false', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        pushEnabled: false,
        pushPreferences: null,
      } as any);

      await sendPushToUser('user1', { title: 'Test', body: 'Body' });

      expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
      expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it('should not send if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await sendPushToUser('user1', { title: 'Test', body: 'Body' });

      expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it('should send push when user has enabled and valid tokens', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        pushEnabled: true,
        pushPreferences: null,
      } as any);

      vi.mocked(prisma.pushToken.findMany).mockResolvedValue([
        { token: 'ExponentPushToken[abc123]' },
      ] as any);

      mockSendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }]);

      await sendPushToUser('user1', { title: 'Test', body: 'Body' });

      expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    });

    it('should skip if user preference disables the category', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        pushEnabled: true,
        pushPreferences: JSON.stringify({ dailyQuiz: false, teamUpdates: true }),
      } as any);

      await sendPushToUser('user1', { title: 'Test', body: 'Body' }, 'dailyQuiz');

      expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
    });

    it('should deactivate token on DeviceNotRegistered error', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        pushEnabled: true,
        pushPreferences: null,
      } as any);

      vi.mocked(prisma.pushToken.findMany).mockResolvedValue([
        { token: 'ExponentPushToken[invalid]' },
      ] as any);

      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
      ]);

      await sendPushToUser('user1', { title: 'Test', body: 'Body' });

      expect(prisma.pushToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'ExponentPushToken[invalid]' },
        data: { active: false },
      });
    });
  });

  describe('sendPushToUsers', () => {
    it('should send to multiple users with valid tokens', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'u1', pushPreferences: null },
        { id: 'u2', pushPreferences: null },
      ] as any);

      vi.mocked(prisma.pushToken.findMany).mockResolvedValue([
        { token: 'ExponentPushToken[t1]' },
        { token: 'ExponentPushToken[t2]' },
      ] as any);

      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok' },
        { status: 'ok' },
      ]);

      await sendPushToUsers(['u1', 'u2'], { title: 'Test', body: 'Body' });

      expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    });

    it('should not send to empty user list', async () => {
      await sendPushToUsers([], { title: 'Test', body: 'Body' });

      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should filter users by preference', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'u1', pushPreferences: JSON.stringify({ teamUpdates: false }) },
        { id: 'u2', pushPreferences: JSON.stringify({ teamUpdates: true }) },
      ] as any);

      vi.mocked(prisma.pushToken.findMany).mockResolvedValue([
        { token: 'ExponentPushToken[t2]' },
      ] as any);

      mockSendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }]);

      await sendPushToUsers(['u1', 'u2'], { title: 'Test', body: 'Body' }, 'teamUpdates');

      // Should only query tokens for u2
      expect(prisma.pushToken.findMany).toHaveBeenCalledWith({
        where: { userId: { in: ['u2'] }, active: true },
        select: { token: true },
      });
    });
  });
});
