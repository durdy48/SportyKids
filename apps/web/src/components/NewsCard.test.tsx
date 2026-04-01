import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewsCard } from './NewsCard';
import type { NewsItem } from '@sportykids/shared';

// Mock user-context
vi.mock('@/lib/user-context', () => ({
  useUser: () => ({ user: { id: 'user1', age: 10 }, locale: 'es' }),
}));

// Mock shared
vi.mock('@sportykids/shared', () => ({
  sportToEmoji: (sport: string) => sport,
  formatDate: () => '2026-03-20',
  t: (key: string) => key,
  getSportLabel: (sport: string) => sport,
}));

// Mock favorites
vi.mock('@/lib/favorites', () => ({
  isFavorite: () => false,
  toggleFavorite: vi.fn(() => true),
}));

// Mock sub-components
vi.mock('./AgeAdaptedSummary', () => ({
  AgeAdaptedSummary: () => <div data-testid="summary" />,
}));
vi.mock('./HeartIcon', () => ({
  HeartIcon: ({ filled }: { filled: boolean }) => <span data-testid="heart">{filled ? 'filled' : 'empty'}</span>,
}));
vi.mock('./ReportButton', () => ({
  ReportButton: () => <button data-testid="report">Report</button>,
}));

const mockNews: NewsItem = {
  id: 'n1',
  title: 'Real Madrid wins La Liga',
  summary: 'A great season for the team.',
  source: 'Marca',
  sourceUrl: 'https://marca.com/article',
  sport: 'football',
  team: 'Real Madrid',
  imageUrl: 'https://example.com/img.jpg',
  minAge: 6,
  maxAge: 14,
  publishedAt: new Date('2026-03-20T12:00:00Z'),
  safetyStatus: 'approved',
};

describe('NewsCard', () => {
  it('renders the news title', () => {
    render(<NewsCard news={mockNews} locale="es" />);
    expect(screen.getByText('Real Madrid wins La Liga')).toBeInTheDocument();
  });

  it('renders the news source', () => {
    render(<NewsCard news={mockNews} locale="es" />);
    expect(screen.getByText('Marca')).toBeInTheDocument();
  });

  it('renders the sport label', () => {
    render(<NewsCard news={mockNews} locale="es" />);
    // sportToEmoji returns sport name, getSportLabel also returns sport name
    expect(screen.getByText('football football')).toBeInTheDocument();
  });

  it('renders the team badge', () => {
    render(<NewsCard news={mockNews} locale="es" />);
    expect(screen.getByText('Real Madrid')).toBeInTheDocument();
  });

  it('renders a read more link pointing to the source URL', () => {
    render(<NewsCard news={mockNews} locale="es" />);
    const link = screen.getByText('buttons.read_more');
    expect(link).toHaveAttribute('href', 'https://marca.com/article');
  });

  describe('accessibility', () => {
    it('favorite button has aria-label', () => {
      render(<NewsCard news={mockNews} locale="es" />);
      const favButtons = screen.getAllByLabelText(/favorites\./);
      expect(favButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('explain button has aria-pressed and aria-label', () => {
      render(<NewsCard news={mockNews} locale="es" />);
      const explainBtn = screen.getByLabelText('Explain in simple terms');
      expect(explainBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
