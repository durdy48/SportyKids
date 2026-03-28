import { describe, it, expect } from 'vitest';
import { resolveTheme, resolveColors, lightColors, darkColors } from '../theme';

describe('theme', () => {
  describe('resolveTheme', () => {
    it('returns light when mode is light', () => {
      expect(resolveTheme('light', 'dark')).toBe('light');
      expect(resolveTheme('light', 'light')).toBe('light');
      expect(resolveTheme('light', null)).toBe('light');
    });

    it('returns dark when mode is dark', () => {
      expect(resolveTheme('dark', 'light')).toBe('dark');
      expect(resolveTheme('dark', 'dark')).toBe('dark');
    });

    it('uses system scheme when mode is system', () => {
      expect(resolveTheme('system', 'dark')).toBe('dark');
      expect(resolveTheme('system', 'light')).toBe('light');
      expect(resolveTheme('system', null)).toBe('light');
    });
  });

  describe('resolveColors', () => {
    it('returns light colors for light mode', () => {
      const colors = resolveColors('light', 'dark');
      expect(colors).toEqual(lightColors);
    });

    it('returns dark colors for dark mode', () => {
      const colors = resolveColors('dark', 'light');
      expect(colors).toEqual(darkColors);
    });

    it('uses system scheme for system mode', () => {
      expect(resolveColors('system', 'dark')).toEqual(darkColors);
      expect(resolveColors('system', 'light')).toEqual(lightColors);
    });
  });

  describe('color values', () => {
    it('light colors have expected blue', () => {
      expect(lightColors.blue).toBe('#2563EB');
    });

    it('dark colors have lighter blue', () => {
      expect(darkColors.blue).toBe('#3B82F6');
    });

    it('dark background is dark', () => {
      expect(darkColors.background).toBe('#0F172A');
    });
  });
});
