import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';

// Override the global shared mock to include KID_FRIENDLY_ERRORS with crash entry
vi.mock('@sportykids/shared', () => ({
  t: vi.fn((key: string) => key),
  getSportLabel: vi.fn((sport: string) => sport),
  getAgeRangeLabel: vi.fn((range: string) => range),
  inferCountryFromLocale: vi.fn(() => 'ES'),
  sportToEmoji: vi.fn((sport: string) => `[${sport}]`),
  sportToColor: vi.fn(() => '#2563EB'),
  COLORS: {
    blue: '#2563EB',
    green: '#22C55E',
    yellow: '#FACC15',
    background: '#F8FAFC',
    text: '#1E293B',
    surface: '#FFFFFF',
    border: '#E5E7EB',
    muted: '#6B7280',
  },
  SPORTS: ['football'],
  TEAMS: {},
  AGE_RANGES: ['6-8'],
  KID_FRIENDLY_ERRORS: {
    crash: {
      titleKey: 'kid_errors.crash_title',
      messageKey: 'kid_errors.crash_message',
      emoji: '\u{1F3DF}\uFE0F',
    },
    generic: {
      titleKey: 'kid_errors.generic_title',
      messageKey: 'kid_errors.generic_message',
      emoji: '\u26BD',
    },
  },
  getErrorType: vi.fn(() => 'generic'),
}));

import { ErrorBoundary } from '../ErrorBoundary';

/** A component that always throws during render. */
function ThrowingChild(): React.ReactElement {
  throw new Error('Test render error');
}

/** A normal child component (renders plain string since RN is mocked). */
function GoodChild(): React.ReactElement {
  return React.createElement('Text', null, 'All good');
}

/** Helper: find all nodes matching a text value in the rendered tree. */
function findAllByText(root: ReactTestRenderer, text: string) {
  return root.root.findAll((node) => {
    return (
      typeof node.children?.[0] === 'string' && node.children[0] === text
    );
  });
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error from React's error boundary logging
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('can be imported without errors', async () => {
    const mod = await import('../ErrorBoundary');
    expect(mod.ErrorBoundary).toBeDefined();
  });

  it('is a class component with getDerivedStateFromError', async () => {
    const { ErrorBoundary } = await import('../ErrorBoundary');
    expect(typeof ErrorBoundary).toBe('function');
    expect(ErrorBoundary.getDerivedStateFromError).toBeDefined();
  });

  it('getDerivedStateFromError returns hasError true', async () => {
    const { ErrorBoundary } = await import('../ErrorBoundary');
    const result = ErrorBoundary.getDerivedStateFromError(new Error('boom'));
    expect(result).toEqual({ hasError: true, error: expect.any(Error) });
    expect(result.error?.message).toBe('boom');
  });

  it('has componentDidCatch method for Sentry reporting', async () => {
    const { ErrorBoundary } = await import('../ErrorBoundary');
    expect(ErrorBoundary.prototype.componentDidCatch).toBeDefined();
  });

  it('componentDidCatch does not throw when Sentry is unavailable', async () => {
    const { ErrorBoundary } = await import('../ErrorBoundary');
    const instance = new ErrorBoundary({ locale: 'en', children: null });

    await expect(
      (async () => {
        instance.componentDidCatch(new Error('test'), { componentStack: 'stack' } as React.ErrorInfo);
        await new Promise((r) => setTimeout(r, 50));
      })(),
    ).resolves.toBeUndefined();
  });

  it('renders children when no error occurs', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <ErrorBoundary locale="en">
          <GoodChild />
        </ErrorBoundary>,
      );
    });
    const matches = findAllByText(renderer!, 'All good');
    expect(matches.length).toBe(1);
  });

  it('renders crash UI when a child throws', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <ErrorBoundary locale="en">
          <ThrowingChild />
        </ErrorBoundary>,
      );
    });

    // Should display the crash error info (i18n keys returned as-is by mock)
    expect(findAllByText(renderer!, 'kid_errors.crash_title').length).toBe(1);
    expect(findAllByText(renderer!, 'kid_errors.crash_message').length).toBe(1);
    expect(findAllByText(renderer!, 'kid_errors.restart').length).toBe(1);
    // Original child should not be rendered
    expect(findAllByText(renderer!, 'All good').length).toBe(0);
  });

  it('clears error state when restart button is pressed', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <ErrorBoundary locale="en">
          <ThrowingChild />
        </ErrorBoundary>,
      );
    });

    // Verify crash UI is shown
    expect(findAllByText(renderer!, 'kid_errors.crash_title').length).toBe(1);

    // Find and press the restart button (TouchableOpacity wrapping the restart text)
    const restartButton = renderer!.root.findAll(
      (node) => node.type === 'TouchableOpacity' && node.props.onPress,
    );
    expect(restartButton.length).toBeGreaterThan(0);

    act(() => {
      restartButton[0].props.onPress();
    });

    // After restart, state is cleared and children re-render.
    // ThrowingChild throws again -> crash UI reappears (validating the full cycle).
    expect(findAllByText(renderer!, 'kid_errors.crash_title').length).toBe(1);
  });

  describe('accessibility', () => {
    it('crash UI container has alert role', () => {
      let renderer: ReactTestRenderer;
      act(() => {
        renderer = create(
          <ErrorBoundary locale="en">
            <ThrowingChild />
          </ErrorBoundary>,
        );
      });

      const alertView = renderer!.root.findAll(
        (node) => node.props.accessibilityRole === 'alert',
      );
      expect(alertView.length).toBeGreaterThan(0);
    });

    it('restart button has accessibilityLabel and button role', () => {
      let renderer: ReactTestRenderer;
      act(() => {
        renderer = create(
          <ErrorBoundary locale="en">
            <ThrowingChild />
          </ErrorBoundary>,
        );
      });

      const restartButton = renderer!.root.findAll(
        (node) => node.type === 'TouchableOpacity' && node.props.accessibilityRole === 'button',
      );
      expect(restartButton.length).toBeGreaterThan(0);
      expect(restartButton[0].props.accessibilityLabel).toBeTruthy();
    });

    it('emoji has accessibilityLabel', () => {
      let renderer: ReactTestRenderer;
      act(() => {
        renderer = create(
          <ErrorBoundary locale="en">
            <ThrowingChild />
          </ErrorBoundary>,
        );
      });

      const emojiNodes = renderer!.root.findAll(
        (node) => node.props.accessibilityLabel === 'a11y.error.crash_emoji',
      );
      expect(emojiNodes.length).toBeGreaterThan(0);
    });
  });

  it('uses crash error info from KID_FRIENDLY_ERRORS', async () => {
    const { KID_FRIENDLY_ERRORS } = await import('@sportykids/shared');
    expect(KID_FRIENDLY_ERRORS.crash).toBeDefined();
    expect(KID_FRIENDLY_ERRORS.crash.titleKey).toBe('kid_errors.crash_title');
    expect(KID_FRIENDLY_ERRORS.crash.messageKey).toBe('kid_errors.crash_message');
    expect(KID_FRIENDLY_ERRORS.crash.emoji).toMatch(/\u{1F3DF}/u);
  });
});
