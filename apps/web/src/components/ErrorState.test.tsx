import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from './ErrorState';

// Mock user-context
vi.mock('@/lib/user-context', () => ({
  useUser: () => ({ locale: 'es' }),
}));

// Mock @sportykids/shared — keep real getErrorType/KID_FRIENDLY_ERRORS
vi.mock('@sportykids/shared', () => ({
  t: (key: string) => key,
  KID_FRIENDLY_ERRORS: {
    network: { titleKey: 'kid_errors.network_title', messageKey: 'kid_errors.network_message', emoji: '\uD83C\uDFC8' },
    not_found: { titleKey: 'kid_errors.not_found_title', messageKey: 'kid_errors.not_found_message', emoji: '\uD83D\uDD0D' },
    server: { titleKey: 'kid_errors.server_title', messageKey: 'kid_errors.server_message', emoji: '\uD83C\uDFD7\uFE0F' },
    generic: { titleKey: 'kid_errors.generic_title', messageKey: 'kid_errors.generic_message', emoji: '\u26BD' },
  },
  getErrorType: (statusOrMessage: number | string) => {
    if (typeof statusOrMessage === 'number') {
      if (statusOrMessage === 404) return 'not_found';
      if (statusOrMessage >= 500) return 'server';
      return 'generic';
    }
    const msg = (statusOrMessage as string).toLowerCase();
    if (msg.includes('network')) return 'network';
    return 'generic';
  },
}));

describe('ErrorState', () => {
  it('renders error title and message from i18n keys', () => {
    render(<ErrorState error={404} />);
    expect(screen.getByText('kid_errors.not_found_title')).toBeInTheDocument();
    expect(screen.getByText('kid_errors.not_found_message')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState error="network error" onRetry={onRetry} />);
    const btn = screen.getByText('kid_errors.retry');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState error={500} />);
    expect(screen.queryByText('kid_errors.retry')).not.toBeInTheDocument();
  });

  it('shows server error for status >= 500', () => {
    render(<ErrorState error={503} />);
    expect(screen.getByText('kid_errors.server_title')).toBeInTheDocument();
  });
});
