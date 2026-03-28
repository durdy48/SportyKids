import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  parentalSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../config/database', () => ({ prisma: mockPrisma }));
vi.mock('./logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  createParentalSession,
  verifyParentalSession,
  cleanupExpiredSessions,
  revokeParentalSessions,
} from './parental-session';

describe('parental-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createParentalSession', () => {
    it('creates a session in DB and returns a UUID token with future expiresAt', async () => {
      mockPrisma.parentalSession.create.mockResolvedValue({});

      const result = await createParentalSession('user-1');

      expect(result.sessionToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(result.expiresAt.getTime()).toBe(
        new Date('2026-03-28T12:00:00Z').getTime() + 5 * 60 * 1000,
      );
      expect(mockPrisma.parentalSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          token: result.sessionToken,
          expiresAt: result.expiresAt,
        },
      });
    });
  });

  describe('verifyParentalSession', () => {
    it('returns userId for a valid (non-expired) token', async () => {
      const futureDate = new Date('2026-03-28T12:10:00Z');
      mockPrisma.parentalSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        token: 'valid-token',
        expiresAt: futureDate,
      });

      const result = await verifyParentalSession('valid-token');

      expect(result).toBe('user-1');
      expect(mockPrisma.parentalSession.findUnique).toHaveBeenCalledWith({
        where: { token: 'valid-token' },
      });
    });

    it('returns null for an expired token and deletes it', async () => {
      const pastDate = new Date('2026-03-28T11:00:00Z');
      mockPrisma.parentalSession.findUnique.mockResolvedValue({
        id: 'sess-2',
        userId: 'user-2',
        token: 'expired-token',
        expiresAt: pastDate,
      });
      mockPrisma.parentalSession.delete.mockResolvedValue({});

      const result = await verifyParentalSession('expired-token');

      expect(result).toBeNull();
      expect(mockPrisma.parentalSession.delete).toHaveBeenCalledWith({
        where: { id: 'sess-2' },
      });
    });

    it('returns null for a nonexistent token', async () => {
      mockPrisma.parentalSession.findUnique.mockResolvedValue(null);

      const result = await verifyParentalSession('nonexistent-token');

      expect(result).toBeNull();
    });

    it('returns null for undefined token', async () => {
      const result = await verifyParentalSession(undefined);

      expect(result).toBeNull();
      expect(mockPrisma.parentalSession.findUnique).not.toHaveBeenCalled();
    });

    it('returns null for empty string token', async () => {
      const result = await verifyParentalSession('');

      expect(result).toBeNull();
      expect(mockPrisma.parentalSession.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('deletes only expired sessions and returns the count', async () => {
      mockPrisma.parentalSession.deleteMany.mockResolvedValue({ count: 3 });

      const result = await cleanupExpiredSessions();

      expect(result).toBe(3);
      expect(mockPrisma.parentalSession.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lte: expect.any(Date) } },
      });
    });

    it('returns 0 when no expired sessions exist', async () => {
      mockPrisma.parentalSession.deleteMany.mockResolvedValue({ count: 0 });

      const result = await cleanupExpiredSessions();

      expect(result).toBe(0);
    });
  });

  describe('revokeParentalSessions', () => {
    it('deletes all sessions for a given user', async () => {
      mockPrisma.parentalSession.deleteMany.mockResolvedValue({ count: 2 });

      await revokeParentalSessions('user-1');

      expect(mockPrisma.parentalSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });
});
