import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    pushToken: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    parentalProfile: {
      findMany: vi.fn(),
    },
  },
}));

// Mock expo-server-sdk
vi.mock('expo-server-sdk', () => {
  return {
    Expo: class {
      static isExpoPushToken() {
        return true;
      }
      chunkPushNotifications(msgs: unknown[]) {
        return [msgs];
      }
      sendPushNotificationsAsync() {
        return Promise.resolve([{ status: 'ok' }]);
      }
    },
  };
});

const { prisma } = await import('../../config/database');
const { sendLiveScoreToUsers } = await import('../push-sender');

describe('sendLiveScoreToUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 if no users match the team', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    const count = await sendLiveScoreToUsers(
      'Real Madrid',
      'goal',
      { title: 'Goal!', body: 'Test' },
    );
    expect(count).toBe(0);
  });

  it('filters users whose liveScores preference is disabled', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: 'u1',
        pushPreferences: { liveScores: { enabled: false, goals: true, matchStart: true, matchEnd: true, halfTime: true, redCards: true } },
        locale: 'es',
      },
    ] as never);
    const count = await sendLiveScoreToUsers(
      'Real Madrid',
      'goal',
      { title: 'Goal!', body: 'Test' },
    );
    expect(count).toBe(0);
  });

  it('filters users whose specific event pref is off', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: 'u1',
        pushPreferences: { liveScores: { enabled: true, goals: false, matchStart: true, matchEnd: true, halfTime: true, redCards: true } },
        locale: 'es',
      },
    ] as never);
    const count = await sendLiveScoreToUsers(
      'Real Madrid',
      'goal',
      { title: 'Goal!', body: 'Test' },
    );
    expect(count).toBe(0);
  });

  it('sends to eligible users with schedule check', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: 'u1',
        pushPreferences: { liveScores: { enabled: true, goals: true, matchStart: true, matchEnd: true, halfTime: true, redCards: true } },
        locale: 'es',
      },
    ] as never);
    vi.mocked(prisma.parentalProfile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.pushToken.findMany).mockResolvedValue([
      { token: 'ExponentPushToken[abc123]' },
    ] as never);

    const count = await sendLiveScoreToUsers(
      'Real Madrid',
      'goal',
      { title: 'Goal!', body: 'Test' },
    );
    expect(count).toBe(1);
  });

  it('respects parental schedule lock', async () => {
    // Fix time to 15:00 UTC so schedule (8-10 UTC) blocks the notification
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T15:00:00Z'));

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: 'u1',
        pushPreferences: { liveScores: { enabled: true, goals: true, matchStart: true, matchEnd: true, halfTime: true, redCards: true } },
        locale: 'es',
      },
    ] as never);
    // Schedule allows 8-10 only — at 15:00 UTC this should block
    vi.mocked(prisma.parentalProfile.findMany).mockResolvedValue([{
      userId: 'u1',
      allowedHoursStart: 8,
      allowedHoursEnd: 10,
      timezone: 'UTC',
    }] as never);

    const count = await sendLiveScoreToUsers(
      'Real Madrid',
      'goal',
      { title: 'Goal!', body: 'Test' },
    );
    expect(count).toBe(0);

    vi.useRealTimers();
  });
});
