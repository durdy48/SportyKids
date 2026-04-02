import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config', () => ({
  API_BASE: 'http://localhost:3001/api',
  WEB_BASE: 'http://localhost:3000',
}));

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: vi.fn() }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: vi.fn(),
}));

vi.mock('../../lib/user-context', () => ({
  useUser: () => ({
    user: { id: 'u1', name: 'Test', role: 'parent', authProvider: 'email', subscriptionTier: 'free' },
    locale: 'es',
    colors: {
      background: '#F8FAFC', text: '#1E293B', muted: '#6B7280',
      surface: '#FFFFFF', border: '#E5E7EB', blue: '#2563EB',
    },
  }),
}));

/**
 * Recursively serialize a React element tree to a string for assertions.
 * Handles function components by calling them, and string-based RN mock components.
 */
function serializeElement(el: unknown): string {
  if (el == null || typeof el === 'boolean') return '';
  if (typeof el === 'string' || typeof el === 'number') return String(el);
  if (Array.isArray(el)) return el.map(serializeElement).join('');
  if (typeof el === 'object' && 'type' in (el as Record<string, unknown>)) {
    const node = el as { type: unknown; props?: Record<string, unknown> };
    const props = node.props ?? {};
    if (typeof node.type === 'function') {
      try {
        const result = (node.type as (p: Record<string, unknown>) => unknown)(props);
        return serializeElement(result);
      } catch {
        return '';
      }
    }
    const propStr = Object.entries(props)
      .filter(([k]) => k !== 'children' && k !== 'style')
      .map(([k, v]) => (typeof v === 'string' ? `${k}=${v}` : typeof v === 'function' ? k : `${k}`))
      .join(' ');
    const children = props.children != null ? serializeElement(props.children) : '';
    return `<${propStr}>${children}</>`;
  }
  return '';
}

describe('LimitReachedModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('can be imported without errors', async () => {
    const mod = await import('../LimitReachedModal');
    expect(mod.LimitReachedModal).toBeDefined();
    expect(typeof mod.LimitReachedModal).toBe('function');
  });

  it('renders news limit message when visible', async () => {
    const { LimitReachedModal } = await import('../LimitReachedModal');
    const tree = serializeElement({
      type: LimitReachedModal,
      props: { visible: true, limitType: 'news', onDismiss: vi.fn() },
    });
    expect(tree).toContain('subscription.limit_reached_news');
    expect(tree).toContain('subscription.limit_reached_cta');
    expect(tree).toContain('subscription.upgrade');
  });

  it('renders sport limit message', async () => {
    const { LimitReachedModal } = await import('../LimitReachedModal');
    const tree = serializeElement({
      type: LimitReachedModal,
      props: { visible: true, limitType: 'sport', onDismiss: vi.fn() },
    });
    expect(tree).toContain('subscription.limit_reached_sport');
  });

  it('renders dismiss button with maybe_later text', async () => {
    const { LimitReachedModal } = await import('../LimitReachedModal');
    const tree = serializeElement({
      type: LimitReachedModal,
      props: { visible: true, limitType: 'quiz', onDismiss: vi.fn() },
    });
    expect(tree).toContain('subscription.maybe_later');
  });

  describe('accessibility', () => {
    it('has accessibilityRole and accessibilityLabel on interactive elements', async () => {
      const { LimitReachedModal } = await import('../LimitReachedModal');
      const tree = serializeElement({
        type: LimitReachedModal,
        props: { visible: true, limitType: 'reels', onDismiss: vi.fn() },
      });
      expect(tree).toContain('accessibilityRole=button');
      expect(tree).toContain('accessibilityLabel');
    });
  });
});
