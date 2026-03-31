import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock shared
vi.mock('@sportykids/shared', () => ({
  t: (key: string, _locale?: string, params?: Record<string, string>) => {
    if (params?.date) return `${key}:${params.date}`;
    return key;
  },
}));

import PrivacyPage from '../app/privacy/page';
import TermsPage from '../app/terms/page';

describe('Privacy Page', () => {
  it('renders without auth', () => {
    render(<PrivacyPage />);
    // Privacy title appears in heading and footer
    expect(screen.getAllByText('legal.privacy_policy').length).toBeGreaterThan(0);
  });

  it('renders the last updated date', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('legal.last_updated:Marzo 2026')).toBeInTheDocument();
  });

  it('has a locale switcher', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('has a back link', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/legal\.back/)).toBeInTheDocument();
  });

  it('has a link to terms page', () => {
    render(<PrivacyPage />);
    expect(screen.getAllByText('legal.terms_of_service').length).toBeGreaterThan(0);
  });
});

describe('Terms Page', () => {
  it('renders without auth', () => {
    render(<TermsPage />);
    // The terms title appears in both the heading and footer
    expect(screen.getAllByText('legal.terms_of_service').length).toBeGreaterThan(0);
  });

  it('renders the last updated date', () => {
    render(<TermsPage />);
    expect(screen.getByText('legal.last_updated:Marzo 2026')).toBeInTheDocument();
  });

  it('has a locale switcher', () => {
    render(<TermsPage />);
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('has a back link', () => {
    render(<TermsPage />);
    expect(screen.getByText(/legal\.back/)).toBeInTheDocument();
  });

  it('has a link to privacy page', () => {
    render(<TermsPage />);
    // Privacy link appears in footer and in the body (section 7)
    expect(screen.getAllByText('legal.privacy_policy').length).toBeGreaterThan(0);
  });
});
