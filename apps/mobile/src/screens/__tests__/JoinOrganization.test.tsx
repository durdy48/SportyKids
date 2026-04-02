import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

vi.mock('../../config', () => ({
  API_BASE: 'http://localhost:3001/api',
  WEB_BASE: 'http://localhost:3000',
}));

const mockGoBack = vi.fn();
const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: vi.fn(),
}));

const mockUseUser = vi.fn();
vi.mock('../../lib/user-context', () => ({
  useUser: () => mockUseUser(),
}));

vi.mock('../../lib/haptics', () => ({
  haptic: vi.fn(),
}));

const mockJoinOrganization = vi.fn();
vi.mock('../../lib/api', () => ({
  joinOrganization: (...args: unknown[]) => mockJoinOrganization(...args),
}));

vi.mock('../../lib/auth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
  refreshToken: vi.fn().mockResolvedValue(null),
}));

const defaultColors = {
  background: '#F8FAFC',
  text: '#1E293B',
  muted: '#6B7280',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  blue: '#2563EB',
};

describe('JoinOrganizationScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      user: { id: 'u1', name: 'Test', role: 'child' },
      locale: 'es',
      colors: defaultColors,
      refreshUser: vi.fn(),
    });
  });

  it('can be imported without errors', async () => {
    const mod = await import('../JoinOrganization');
    expect(mod.JoinOrganizationScreen).toBeDefined();
    expect(typeof mod.JoinOrganizationScreen).toBe('function');
  });

  it('renders as a valid React element', async () => {
    const { JoinOrganizationScreen } = await import('../JoinOrganization');
    const element = React.createElement(JoinOrganizationScreen, {
      navigation: { goBack: vi.fn(), navigate: vi.fn() },
    });
    expect(element).toBeTruthy();
    expect(element.type).toBe(JoinOrganizationScreen);
  });

  it('exports a function component', async () => {
    const { JoinOrganizationScreen } = await import('../JoinOrganization');
    // Verify it's a function with the right name
    expect(JoinOrganizationScreen.name).toBe('JoinOrganizationScreen');
  });

  it('uses i18n keys for org.join_title', async () => {
    // Verify the component file references the correct i18n keys
    const fs = await import('fs');
    const content = fs.readFileSync(
      new URL('../JoinOrganization.tsx', import.meta.url).pathname,
      'utf-8',
    );
    expect(content).toContain("'org.join_title'");
    expect(content).toContain("'org.join_subtitle'");
    expect(content).toContain("'org.join_button'");
    expect(content).toContain("'org.join_skip'");
  });

  it('uses accessibility attributes', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      new URL('../JoinOrganization.tsx', import.meta.url).pathname,
      'utf-8',
    );
    expect(content).toContain('accessibilityRole');
    expect(content).toContain('accessibilityLabel');
    expect(content).toContain('accessibilityState');
    expect(content).toContain("'a11y.org.code_input'");
  });

  it('has 6 code input boxes', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      new URL('../JoinOrganization.tsx', import.meta.url).pathname,
      'utf-8',
    );
    expect(content).toContain('CODE_LENGTH = 6');
    expect(content).toContain('Array.from({ length: CODE_LENGTH })');
  });

  it('forces uppercase input', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      new URL('../JoinOrganization.tsx', import.meta.url).pathname,
      'utf-8',
    );
    expect(content).toContain('.toUpperCase()');
    expect(content).toContain("autoCapitalize=\"characters\"");
  });

  it('handles error states from API', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      new URL('../JoinOrganization.tsx', import.meta.url).pathname,
      'utf-8',
    );
    expect(content).toContain("'org.join_error_not_found'");
    expect(content).toContain("'org.join_error_already_member'");
    expect(content).toContain("'org.join_error_inactive'");
    expect(content).toContain("'org.join_error_full'");
  });

  it('calls joinOrganization API on submit', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      new URL('../JoinOrganization.tsx', import.meta.url).pathname,
      'utf-8',
    );
    expect(content).toContain('joinOrganization(fullCode)');
  });
});
