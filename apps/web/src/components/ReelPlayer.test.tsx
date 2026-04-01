import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReelPlayer } from './ReelPlayer';
import type { Reel } from '@sportykids/shared';

vi.mock('@sportykids/shared', () => ({
  sportToEmoji: (sport: string) => sport,
  getSportLabel: (sport: string) => sport,
  t: (key: string) => key,
}));

vi.mock('@/lib/reel-likes', () => ({
  getLikedReels: () => new Set(),
  toggleLike: vi.fn(() => true),
}));

const mockReel: Reel = {
  id: 'r1',
  title: 'Amazing goal compilation',
  videoUrl: 'https://www.youtube.com/embed/abc123',
  thumbnailUrl: 'https://img.youtube.com/vi/abc123/0.jpg',
  sport: 'football',
  team: 'Barcelona',
  source: 'YouTube',
  minAge: 6,
  maxAge: 14,
  durationSeconds: 60,
  publishedAt: '2026-03-20T12:00:00Z',
  safetyStatus: 'approved',
};

describe('ReelPlayer', () => {
  it('renders an iframe with the video URL', () => {
    render(<ReelPlayer reel={mockReel} isActive={true} locale="es" />);
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toContain('youtube.com/embed/abc123');
  });

  it('renders the reel title', () => {
    render(<ReelPlayer reel={mockReel} isActive={true} locale="es" />);
    expect(screen.getByText('Amazing goal compilation')).toBeInTheDocument();
  });

  it('renders the sport label', () => {
    render(<ReelPlayer reel={mockReel} isActive={true} locale="es" />);
    expect(screen.getByText('football football')).toBeInTheDocument();
  });

  it('renders team badge when team is present', () => {
    render(<ReelPlayer reel={mockReel} isActive={true} locale="es" />);
    expect(screen.getByText('Barcelona')).toBeInTheDocument();
  });

  it('renders like and share buttons', () => {
    render(<ReelPlayer reel={mockReel} isActive={true} locale="es" />);
    expect(screen.getByLabelText('reels.like')).toBeInTheDocument();
    expect(screen.getByLabelText('reels.share')).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('like button has aria-label', () => {
      render(<ReelPlayer reel={mockReel} isActive={true} locale="es" />);
      expect(screen.getByLabelText('reels.like')).toBeInTheDocument();
    });

    it('share button has aria-label', () => {
      render(<ReelPlayer reel={mockReel} isActive={true} locale="es" />);
      expect(screen.getByLabelText('reels.share')).toBeInTheDocument();
    });

    it('iframe has a title attribute for accessibility', () => {
      render(<ReelPlayer reel={mockReel} isActive={true} locale="es" />);
      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveAttribute('title', 'Amazing goal compilation');
    });
  });
});
