import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/age-gate',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock shared
vi.mock('@sportykids/shared', () => ({
  t: (key: string) => key,
}));

// Mock user context
const mockUser = { id: 'u1', name: 'Test', favoriteSports: [], ageGateCompleted: false };
const mockSetUser = vi.fn();
vi.mock('@/lib/user-context', () => ({
  useUser: () => ({
    user: mockUser,
    setUser: mockSetUser,
    locale: 'es',
    loading: false,
  }),
}));

// Mock api
vi.mock('@/lib/api', () => ({
  updateUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Test', ageGateCompleted: true }),
  setupParentalPin: vi.fn().mockResolvedValue({}),
}));

// Mock PinInput
vi.mock('@/components/PinInput', () => ({
  PinInput: ({ onSubmit, title }: { onSubmit: (pin: string) => void; title: string }) => (
    <div>
      <span>{title}</span>
      <button onClick={() => onSubmit('1234')}>submit-pin</button>
    </div>
  ),
}));

import AgeGatePage from '../app/(main)/age-gate/page';

describe('AgeGatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders three age options', () => {
    render(<AgeGatePage />);
    expect(screen.getByTestId('age-option-parent')).toBeInTheDocument();
    expect(screen.getByTestId('age-option-teen')).toBeInTheDocument();
    expect(screen.getByTestId('age-option-child')).toBeInTheDocument();
  });

  it('renders the age gate title', () => {
    render(<AgeGatePage />);
    expect(screen.getByText('age_gate.title')).toBeInTheDocument();
  });

  it('teen option leads to teen acceptance screen', () => {
    render(<AgeGatePage />);
    fireEvent.click(screen.getByTestId('age-option-teen'));
    expect(screen.getByText('age_gate.teen_notice_title')).toBeInTheDocument();
    expect(screen.getByText('age_gate.teen_accept')).toBeInTheDocument();
  });

  it('child option leads to child consent screen', () => {
    render(<AgeGatePage />);
    fireEvent.click(screen.getByTestId('age-option-child'));
    expect(screen.getByText('age_gate.child_consent_title')).toBeInTheDocument();
    expect(screen.getByText('age_gate.child_consent_checkbox')).toBeInTheDocument();
  });

  it('child consent screen leads to PIN creation when checkbox is checked', () => {
    render(<AgeGatePage />);
    // Navigate to child screen
    fireEvent.click(screen.getByTestId('age-option-child'));
    // Check the consent checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    // Click set PIN button
    const setPinButton = screen.getByText('age_gate.child_consent_set_pin');
    fireEvent.click(setPinButton);
    // Should show PIN creation screen
    expect(screen.getByText('onboarding.pin_create')).toBeInTheDocument();
  });

  it('links to privacy and terms pages', () => {
    render(<AgeGatePage />);
    expect(screen.getByText('legal.privacy_policy')).toBeInTheDocument();
    expect(screen.getByText('legal.terms_of_service')).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('age option buttons have aria-labels', () => {
      render(<AgeGatePage />);
      expect(screen.getByLabelText('I am a parent or guardian')).toBeInTheDocument();
      expect(screen.getByLabelText('I am a teenager, 13 to 17')).toBeInTheDocument();
      expect(screen.getByLabelText('I am under 13')).toBeInTheDocument();
    });

    it('teen consent checkbox has aria-label', () => {
      render(<AgeGatePage />);
      fireEvent.click(screen.getByTestId('age-option-teen'));
      expect(screen.getByLabelText('Accept terms as a teenager')).toBeInTheDocument();
    });

    it('child consent checkbox has aria-label', () => {
      render(<AgeGatePage />);
      fireEvent.click(screen.getByTestId('age-option-child'));
      expect(screen.getByLabelText('Parental consent for child under 13')).toBeInTheDocument();
    });
  });
});
