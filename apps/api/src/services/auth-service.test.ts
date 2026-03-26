import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../config/database', () => ({
  prisma: {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const { prisma } = await import('../config/database');

import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  hashPassword,
  verifyPassword,
} from './auth-service';

describe('auth-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('JWT tokens', () => {
    it('should generate and verify a valid access token', () => {
      const payload = { userId: 'user123', role: 'child' as const };
      const token = generateAccessToken(payload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded).toBeTruthy();
      expect(decoded!.userId).toBe('user123');
      expect(decoded!.role).toBe('child');
    });

    it('should return null for invalid token', () => {
      const result = verifyAccessToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should include parentUserId when provided', () => {
      const payload = { userId: 'child1', role: 'child' as const, parentUserId: 'parent1' };
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded!.parentUserId).toBe('parent1');
    });
  });

  describe('refresh tokens', () => {
    it('should create a refresh token in the database', async () => {
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

      const result = await generateRefreshToken('user123');

      expect(result.token).toBeTruthy();
      expect(result.token.length).toBeGreaterThan(32);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent refresh token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null);

      const result = await refreshAccessToken('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null for expired refresh token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000), // expired
        user: { role: 'child', parentUserId: null },
      } as any);

      const result = await refreshAccessToken('expired-token');
      expect(result).toBeNull();
      expect(prisma.refreshToken.delete).toHaveBeenCalled();
    });

    it('should rotate valid refresh token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000), // future
        user: { role: 'parent', parentUserId: null },
      } as any);

      vi.mocked(prisma.refreshToken.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

      const result = await refreshAccessToken('valid-token');

      expect(result).toBeTruthy();
      expect(result!.accessToken).toBeTruthy();
      expect(result!.refreshToken).toBeTruthy();
      // Old token deleted
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt1' } });
      // New token created
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('should revoke refresh token', async () => {
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 } as any);

      await revokeRefreshToken('some-token');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'some-token' },
      });
    });
  });

  describe('password hashing', () => {
    it('should hash and verify a password', async () => {
      const password = 'securePassword123';
      const hashed = await hashPassword(password);

      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(20);

      const isValid = await verifyPassword(password, hashed);
      expect(isValid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const hashed = await hashPassword('correctPassword');
      const isValid = await verifyPassword('wrongPassword', hashed);
      expect(isValid).toBe(false);
    });
  });
});
