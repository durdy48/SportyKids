import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParentalPanel } from './ParentalPanel';
import type { ParentalProfile } from '@sportykids/shared';

// Mock shared
vi.mock('@sportykids/shared', () => ({
  SPORTS: ['football', 'basketball'],
  sportToEmoji: (s: string) => s,
  t: (key: string) => key,
  getSportLabel: (s: string) => s,
  getAgeRangeLabel: (r: string) => r,
}));

// Mock user-context
vi.mock('@/lib/user-context', () => ({
  useUser: () => ({
    user: { id: 'u1', name: 'Test Kid', age: 10, favoriteSports: '["football"]' },
    setUser: vi.fn(),
    setParentalProfile: vi.fn(),
    locale: 'es',
  }),
}));

// Mock API functions
vi.mock('@/lib/api', () => ({
  updateParentalProfile: vi.fn(),
  fetchActivity: vi.fn(() => Promise.resolve({ news_viewed: 5, reels_viewed: 3, quizzes_played: 2, totalPoints: 100 })),
  fetchActivityDetail: vi.fn(() => Promise.resolve({ days: [], mostViewed: 'football' })),
  verifyPin: vi.fn(),
  setupParentalPin: vi.fn(),
  updateUser: vi.fn(),
  getDigestPreferences: vi.fn(() => Promise.resolve({ digestEnabled: false })),
  updateDigestPreferences: vi.fn(),
  previewDigest: vi.fn(),
  downloadDigestPdf: vi.fn(),
}));

// Mock sub-components
vi.mock('./FeedPreviewModal', () => ({
  FeedPreviewModal: () => <div data-testid="feed-preview-modal" />,
}));
vi.mock('./ContentReportList', () => ({
  ContentReportList: () => <div data-testid="content-report-list" />,
}));

const mockProfile: ParentalProfile = {
  userId: 'u1',
  allowedFormats: ['news', 'reels', 'quiz'],
  allowedFeeds: [],
  maxDailyTimeMinutes: 60,
  allowedSports: [],
};

describe('ParentalPanel', () => {
  it('renders the panel with tabs', () => {
    render(<ParentalPanel profile={mockProfile} />);
    expect(screen.getByText('parental.tab_profile')).toBeInTheDocument();
    expect(screen.getByText('parental.tab_content')).toBeInTheDocument();
    expect(screen.getByText('parental.tab_restrictions')).toBeInTheDocument();
  });

  it('defaults to the profile tab', () => {
    render(<ParentalPanel profile={mockProfile} />);
    // The profile tab should show a text input for editing the child's name
    expect(screen.getByDisplayValue('Test Kid')).toBeInTheDocument();
  });

  it('switches to the restrictions tab when clicked', () => {
    render(<ParentalPanel profile={mockProfile} />);
    fireEvent.click(screen.getByText('parental.tab_restrictions'));
    expect(screen.getByText('parental.allowed_formats')).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('tabs have role="tablist" and individual role="tab"', () => {
      render(<ParentalPanel profile={mockProfile} />);
      expect(screen.getByRole('tablist', { name: 'Parental control tabs' })).toBeInTheDocument();
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThanOrEqual(3);
    });

    it('active tab has aria-selected="true"', () => {
      render(<ParentalPanel profile={mockProfile} />);
      const profileTab = screen.getByText('parental.tab_profile');
      expect(profileTab).toHaveAttribute('aria-selected', 'true');
      const contentTab = screen.getByText('parental.tab_content');
      expect(contentTab).toHaveAttribute('aria-selected', 'false');
    });

    it('format toggle buttons have role="switch" and aria-checked in restrictions tab', () => {
      render(<ParentalPanel profile={mockProfile} />);
      fireEvent.click(screen.getByText('parental.tab_restrictions'));
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThanOrEqual(1);
      switches.forEach((sw) => {
        expect(sw).toHaveAttribute('aria-checked');
      });
    });
  });
});
