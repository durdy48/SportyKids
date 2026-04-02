import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
  },
}));

const { prisma } = await import('../../config/database');
const { generateCode, isValidCodeFormat, generateUniqueCode, slugify, generateUniqueSlug } = await import('../invite-code');

describe('invite-code service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // generateCode
  // -------------------------------------------------------------------------

  describe('generateCode', () => {
    it('generates a 6-character code', () => {
      const code = generateCode();
      expect(code).toHaveLength(6);
    });

    it('uses only valid alphabet characters', () => {
      const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      for (let i = 0; i < 100; i++) {
        const code = generateCode();
        for (const char of code) {
          expect(alphabet).toContain(char);
        }
      }
    });

    it('excludes ambiguous characters (O, 0, I, 1, L)', () => {
      const ambiguous = ['O', '0', 'I', '1', 'L'];
      for (let i = 0; i < 200; i++) {
        const code = generateCode();
        for (const char of code) {
          expect(ambiguous).not.toContain(char);
        }
      }
    });

    it('generates different codes on successive calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        codes.add(generateCode());
      }
      // With 28^6 combinations, 50 codes should almost certainly all be unique
      expect(codes.size).toBeGreaterThan(40);
    });
  });

  // -------------------------------------------------------------------------
  // isValidCodeFormat
  // -------------------------------------------------------------------------

  describe('isValidCodeFormat', () => {
    it('returns true for valid codes', () => {
      expect(isValidCodeFormat('HK7M3P')).toBe(true);
      expect(isValidCodeFormat('ABCDEF')).toBe(true);
      expect(isValidCodeFormat('234567')).toBe(true);
    });

    it('returns false for wrong length', () => {
      expect(isValidCodeFormat('HK7M3')).toBe(false);
      expect(isValidCodeFormat('HK7M3PX')).toBe(false);
      expect(isValidCodeFormat('')).toBe(false);
    });

    it('returns false for ambiguous characters', () => {
      expect(isValidCodeFormat('OK7M3P')).toBe(false); // O
      expect(isValidCodeFormat('0K7M3P')).toBe(false); // 0
      expect(isValidCodeFormat('IK7M3P')).toBe(false); // I
      expect(isValidCodeFormat('1K7M3P')).toBe(false); // 1
      expect(isValidCodeFormat('LK7M3P')).toBe(false); // L
    });

    it('returns false for lowercase', () => {
      expect(isValidCodeFormat('hk7m3p')).toBe(false);
    });

    it('returns false for special characters', () => {
      expect(isValidCodeFormat('HK-M3P')).toBe(false);
      expect(isValidCodeFormat('HK M3P')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // generateUniqueCode
  // -------------------------------------------------------------------------

  describe('generateUniqueCode', () => {
    it('returns a code when no collision', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
      const code = await generateUniqueCode();
      expect(code).toHaveLength(6);
      expect(prisma.organization.findUnique).toHaveBeenCalledTimes(1);
    });

    it('retries on collision and returns a unique code', async () => {
      vi.mocked(prisma.organization.findUnique)
        .mockResolvedValueOnce({ id: 'existing' } as never)
        .mockResolvedValueOnce({ id: 'existing' } as never)
        .mockResolvedValueOnce(null);

      const code = await generateUniqueCode();
      expect(code).toHaveLength(6);
      expect(prisma.organization.findUnique).toHaveBeenCalledTimes(3);
    });

    it('throws after max retries', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: 'existing' } as never);
      await expect(generateUniqueCode()).rejects.toThrow('Failed to generate unique invite code');
    });
  });

  // -------------------------------------------------------------------------
  // slugify
  // -------------------------------------------------------------------------

  describe('slugify', () => {
    it('converts to lowercase with hyphens', () => {
      expect(slugify('CD Leganes Academy')).toBe('cd-leganes-academy');
    });

    it('removes special characters', () => {
      expect(slugify('Club Atlético Madrid!')).toBe('club-atletico-madrid');
    });

    it('removes diacritics', () => {
      expect(slugify('Fútbol España Niños')).toBe('futbol-espana-ninos');
    });

    it('collapses multiple hyphens and spaces', () => {
      expect(slugify('My   Club   Name')).toBe('my-club-name');
      expect(slugify('My---Club---Name')).toBe('my-club-name');
    });

    it('trims whitespace', () => {
      expect(slugify('  My Club  ')).toBe('my-club');
    });
  });

  // -------------------------------------------------------------------------
  // generateUniqueSlug
  // -------------------------------------------------------------------------

  describe('generateUniqueSlug', () => {
    it('returns slug directly when no collision', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
      const slug = await generateUniqueSlug('CD Leganes Academy');
      expect(slug).toBe('cd-leganes-academy');
    });

    it('appends numeric suffix on collision', async () => {
      vi.mocked(prisma.organization.findUnique)
        .mockResolvedValueOnce({ id: 'existing' } as never) // cd-leganes-academy taken
        .mockResolvedValueOnce(null); // cd-leganes-academy-2 available

      const slug = await generateUniqueSlug('CD Leganes Academy');
      expect(slug).toBe('cd-leganes-academy-2');
    });

    it('throws if name produces empty slug', async () => {
      await expect(generateUniqueSlug('!!!')).rejects.toThrow('empty slug');
    });
  });
});
