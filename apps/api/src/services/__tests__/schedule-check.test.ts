import { describe, it, expect } from 'vitest';
import { isWithinAllowedHours } from '../schedule-check';

describe('schedule-check', () => {
  describe('isWithinAllowedHours', () => {
    it('returns true when no restrictions (0-24)', () => {
      const now = new Date('2026-04-01T14:00:00Z');
      expect(isWithinAllowedHours(0, 24, 'UTC', now)).toBe(true);
    });

    it('returns true within normal range', () => {
      const now = new Date('2026-04-01T10:00:00Z');
      expect(isWithinAllowedHours(8, 20, 'UTC', now)).toBe(true);
    });

    it('returns false outside normal range', () => {
      const now = new Date('2026-04-01T22:00:00Z');
      expect(isWithinAllowedHours(8, 20, 'UTC', now)).toBe(false);
    });

    it('handles cross-midnight range (allowed)', () => {
      const now = new Date('2026-04-01T23:00:00Z');
      expect(isWithinAllowedHours(22, 6, 'UTC', now)).toBe(true);
    });

    it('handles cross-midnight range (blocked)', () => {
      const now = new Date('2026-04-01T10:00:00Z');
      expect(isWithinAllowedHours(22, 6, 'UTC', now)).toBe(false);
    });

    it('respects timezone', () => {
      // 14:00 UTC = 16:00 Madrid (CEST, +2 in summer)
      const now = new Date('2026-04-01T14:00:00Z');
      expect(isWithinAllowedHours(8, 15, 'Europe/Madrid', now)).toBe(false);
    });

    it('falls back to UTC for invalid timezone', () => {
      const now = new Date('2026-04-01T10:00:00Z');
      expect(isWithinAllowedHours(8, 20, 'Invalid/Zone', now)).toBe(true);
    });
  });
});
