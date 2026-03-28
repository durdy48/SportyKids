import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { UserProvider, useUser } from './user-context';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock API calls
vi.mock('./api', () => ({
  getUser: vi.fn(),
  getParentalProfile: vi.fn(),
  checkIn: vi.fn(),
  updateUser: vi.fn(),
}));

// Mock celebrations
vi.mock('./celebrations', () => ({
  celebrateSticker: vi.fn(),
  celebrateAchievement: vi.fn(),
  celebrateStreak: vi.fn(),
}));

function TestConsumer() {
  const { user, locale, loading, setUser, setLocale, logout } = useUser();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="locale">{locale}</span>
      <span data-testid="user">{user ? user.name : 'none'}</span>
      <button onClick={() => setUser({ id: 'u1', name: 'Pablo', age: 10 } as never)}>setUser</button>
      <button onClick={() => setLocale('en')}>setLocale</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('UserContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('provides default locale as es', async () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );
    expect(screen.getByTestId('locale').textContent).toBe('es');
  });

  it('provides null user by default', async () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );
    // After loading completes, user should be null
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('sets user and persists to localStorage', async () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );

    await act(async () => {
      screen.getByText('setUser').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('Pablo');
    expect(localStorage.getItem('sportykids_usuario_id')).toBe('u1');
  });

  it('changes locale and persists to localStorage', async () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );

    await act(async () => {
      screen.getByText('setLocale').click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(localStorage.getItem('sportykids_locale')).toBe('en');
  });

  it('clears user on logout', async () => {
    render(
      <UserProvider>
        <TestConsumer />
      </UserProvider>
    );

    await act(async () => {
      screen.getByText('setUser').click();
    });
    expect(screen.getByTestId('user').textContent).toBe('Pablo');

    await act(async () => {
      screen.getByText('logout').click();
    });
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(localStorage.getItem('sportykids_usuario_id')).toBeNull();
  });
});
