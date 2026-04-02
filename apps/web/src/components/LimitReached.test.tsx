import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LimitReached } from './LimitReached';

// Mock user-context
vi.mock('@/lib/user-context', () => ({
  useUser: () => ({ locale: 'en' }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock shared
vi.mock('@sportykids/shared', () => ({
  t: (key: string) => key,
}));

describe('LimitReached', () => {
  it('renders default limit_reached type', () => {
    render(<LimitReached />);
    expect(screen.getByText('limit.reached_title')).toBeTruthy();
    expect(screen.getByText('limit.reached_message')).toBeTruthy();
  });

  it('renders news_limit_reached type', () => {
    render(<LimitReached type="news_limit_reached" />);
    expect(screen.getByText('limit.reached_title')).toBeTruthy();
    expect(screen.getByText('limit.news_reached_message')).toBeTruthy();
  });

  it('renders reels_limit_reached type', () => {
    render(<LimitReached type="reels_limit_reached" />);
    expect(screen.getByText('limit.reels_reached_message')).toBeTruthy();
  });

  it('renders quiz_limit_reached type', () => {
    render(<LimitReached type="quiz_limit_reached" />);
    expect(screen.getByText('limit.quiz_reached_message')).toBeTruthy();
  });

  it('renders format_blocked type', () => {
    render(<LimitReached type="format_blocked" />);
    expect(screen.getByText('limit.format_blocked')).toBeTruthy();
  });

  it('renders schedule_locked with hours', () => {
    render(<LimitReached type="schedule_locked" allowedHoursStart={7} allowedHoursEnd={21} />);
    // schedule_locked uses schedule.locked_title
    expect(screen.getByText('schedule.locked_title')).toBeTruthy();
  });

  it('renders go home button', () => {
    render(<LimitReached />);
    expect(screen.getByText('limit.go_home')).toBeTruthy();
  });

  it('renders subscription_limit_reached type with upgrade button', () => {
    render(<LimitReached type="subscription_limit_reached" />);
    expect(screen.getByText('subscription.limit_reached_cta')).toBeTruthy();
    expect(screen.getByText('subscription.upgrade')).toBeTruthy();
  });

  it('renders subscription_sport_restricted type with upgrade button', () => {
    render(<LimitReached type="subscription_sport_restricted" />);
    expect(screen.getByText('subscription.limit_reached_cta')).toBeTruthy();
    expect(screen.getByText('subscription.upgrade')).toBeTruthy();
  });

  it('subscription types show upgrade button instead of go home', () => {
    const { container } = render(<LimitReached type="subscription_limit_reached" />);
    // Should not have a "go home" button for subscription types
    expect(container.textContent).not.toContain('limit.go_home');
    expect(container.textContent).toContain('subscription.upgrade');
  });

  describe('accessibility', () => {
    it('go home button has aria-label', () => {
      render(<LimitReached />);
      expect(screen.getByLabelText('Go back to home')).toBeInTheDocument();
    });

    it('upgrade button has aria-label for subscription types', () => {
      render(<LimitReached type="subscription_limit_reached" />);
      expect(screen.getByLabelText('subscription.upgrade')).toBeInTheDocument();
    });
  });
});
