import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingWizard } from './OnboardingWizard';

// Mock shared
vi.mock('@sportykids/shared', () => ({
  SPORTS: ['football', 'basketball', 'tennis'],
  TEAMS: ['Real Madrid', 'Barcelona'],
  AGE_RANGES: {
    '6-8': { min: 6, max: 8 },
    '9-11': { min: 9, max: 11 },
    '12-14': { min: 12, max: 14 },
  },
  sportToEmoji: (s: string) => s,
  t: (key: string) => key,
  getSportLabel: (s: string) => s,
  getAgeRangeLabel: (r: string) => r,
  inferCountryFromLocale: () => 'ES',
}));

// Mock user-context
const mockSetUser = vi.fn();
const mockSetParentalProfile = vi.fn();
const mockSetLocale = vi.fn();
vi.mock('@/lib/user-context', () => ({
  useUser: () => ({
    setUser: mockSetUser,
    setParentalProfile: mockSetParentalProfile,
    locale: 'es',
    setLocale: mockSetLocale,
  }),
}));

// Mock API
vi.mock('@/lib/api', () => ({
  createUser: vi.fn(),
  fetchSourceCatalog: vi.fn(() => Promise.resolve({ sources: [] })),
  addCustomSource: vi.fn(),
  setupParentalPin: vi.fn(),
  fetchAuthProviders: vi.fn(() => Promise.resolve({ google: false, apple: false })),
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getGoogleLoginUrl: () => 'http://localhost:3001/api/auth/google',
  getAppleLoginUrl: () => 'http://localhost:3001/api/auth/apple',
}));

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step 1 with name input and age range selection', () => {
    render(<OnboardingWizard />);
    expect(screen.getByText('onboarding.step1_title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('onboarding.name_placeholder')).toBeInTheDocument();
    expect(screen.getByText('6-8')).toBeInTheDocument();
    expect(screen.getByText('9-11')).toBeInTheDocument();
    expect(screen.getByText('12-14')).toBeInTheDocument();
  });

  it('disables Next button when name is empty or age is not selected', () => {
    render(<OnboardingWizard />);
    const nextBtn = screen.getByText('buttons.next');
    expect(nextBtn).toBeDisabled();
  });

  it('enables Next button when name and age are provided', () => {
    render(<OnboardingWizard />);
    const nameInput = screen.getByPlaceholderText('onboarding.name_placeholder');
    fireEvent.change(nameInput, { target: { value: 'Pablo' } });
    fireEvent.click(screen.getByText('9-11'));

    const nextBtn = screen.getByText('buttons.next');
    expect(nextBtn).not.toBeDisabled();
  });

  it('navigates to step 2 when Next is clicked on step 1', () => {
    render(<OnboardingWizard />);
    const nameInput = screen.getByPlaceholderText('onboarding.name_placeholder');
    fireEvent.change(nameInput, { target: { value: 'Pablo' } });
    fireEvent.click(screen.getByText('9-11'));
    fireEvent.click(screen.getByText('buttons.next'));

    // Step 2: sports selection
    expect(screen.getByText('onboarding.step2_title')).toBeInTheDocument();
    expect(screen.getByText('football football')).toBeInTheDocument();
  });

  it('shows Back button on step 2 and navigates back to step 1', () => {
    render(<OnboardingWizard />);
    // Go to step 2
    fireEvent.change(screen.getByPlaceholderText('onboarding.name_placeholder'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('9-11'));
    fireEvent.click(screen.getByText('buttons.next'));

    expect(screen.getByText('buttons.back')).toBeInTheDocument();
    fireEvent.click(screen.getByText('buttons.back'));
    expect(screen.getByText('onboarding.step1_title')).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('age range buttons have aria-pressed', () => {
      render(<OnboardingWizard />);
      const ageButtons = screen.getAllByRole('button').filter((btn) => btn.getAttribute('aria-label')?.startsWith('Age range'));
      expect(ageButtons.length).toBe(3);
      ageButtons.forEach((btn) => {
        expect(btn).toHaveAttribute('aria-pressed');
      });
    });

    it('sport selection buttons have aria-pressed on step 2', () => {
      render(<OnboardingWizard />);
      fireEvent.change(screen.getByPlaceholderText('onboarding.name_placeholder'), { target: { value: 'Pablo' } });
      fireEvent.click(screen.getByText('9-11'));
      fireEvent.click(screen.getByText('buttons.next'));

      const sportButtons = screen.getAllByRole('button').filter((btn) => btn.getAttribute('aria-label')?.startsWith('Sport:'));
      expect(sportButtons.length).toBe(3);
      sportButtons.forEach((btn) => {
        expect(btn).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });
});
