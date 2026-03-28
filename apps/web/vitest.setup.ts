import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock next/image — render as plain <img>
vi.mock('next/image', () => ({
  default: ({ fill, priority, ...rest }: Record<string, unknown>) => {
    void fill; void priority;
    const createElement = require('react').createElement;
    return createElement('img', rest);
  },
}));

// Mock next/link — render as plain <a>
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: unknown; href: string; [key: string]: unknown }) => {
    const createElement = require('react').createElement;
    return createElement('a', { href, ...rest }, children);
  },
}));

// Mock canvas-confetti (used by celebrations.ts)
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock celebrations
vi.mock('@/lib/celebrations', () => ({
  celebratePerfectQuiz: vi.fn(),
  celebrateSticker: vi.fn(),
  celebrateAchievement: vi.fn(),
  celebrateStreak: vi.fn(),
}));
