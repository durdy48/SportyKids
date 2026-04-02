import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JoinOrgModal } from '../JoinOrgModal';

// Mock shared
vi.mock('@sportykids/shared', () => ({
  t: (key: string) => key,
}));

// Mock api
const mockJoinOrganization = vi.fn();
vi.mock('../../lib/api', () => ({
  joinOrganization: (...args: unknown[]) => mockJoinOrganization(...args),
}));

const defaultColors = {
  background: '#F8FAFC',
  text: '#1E293B',
  muted: '#6B7280',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  blue: '#2563EB',
};

describe('JoinOrgModal', () => {
  const onClose = vi.fn();
  const onJoined = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and subtitle', () => {
    render(
      <JoinOrgModal onClose={onClose} onJoined={onJoined} locale="en" colors={defaultColors} />,
    );
    expect(screen.getByText('org.join_title')).toBeTruthy();
    expect(screen.getByText('org.join_subtitle')).toBeTruthy();
  });

  it('renders code input field', () => {
    render(
      <JoinOrgModal onClose={onClose} onJoined={onJoined} locale="en" colors={defaultColors} />,
    );
    const input = screen.getByRole('textbox');
    expect(input).toBeTruthy();
    expect(input.getAttribute('maxlength')).toBe('6');
  });

  it('renders join and cancel buttons', () => {
    render(
      <JoinOrgModal onClose={onClose} onJoined={onJoined} locale="en" colors={defaultColors} />,
    );
    expect(screen.getByText('org.join_button')).toBeTruthy();
    expect(screen.getByText('delete_account.confirm_cancel')).toBeTruthy();
  });

  it('converts input to uppercase', () => {
    render(
      <JoinOrgModal onClose={onClose} onJoined={onJoined} locale="en" colors={defaultColors} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc123' } });
    expect(input.value).toBe('ABC123');
  });

  it('calls onClose when cancel is clicked', () => {
    render(
      <JoinOrgModal onClose={onClose} onJoined={onJoined} locale="en" colors={defaultColors} />,
    );
    fireEvent.click(screen.getByText('delete_account.confirm_cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has dialog role and aria-modal', () => {
    render(
      <JoinOrgModal onClose={onClose} onJoined={onJoined} locale="en" colors={defaultColors} />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows error when join fails with 404', async () => {
    const error = new Error('Not found');
    (error as unknown as Record<string, unknown>).status = 404;
    mockJoinOrganization.mockRejectedValue(error);

    render(
      <JoinOrgModal onClose={onClose} onJoined={onJoined} locale="en" colors={defaultColors} />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'HK7M3P' } });
    fireEvent.click(screen.getByText('org.join_button'));

    // Wait for async
    await vi.waitFor(() => {
      expect(screen.getByText('org.join_error_not_found')).toBeTruthy();
    });
  });
});
