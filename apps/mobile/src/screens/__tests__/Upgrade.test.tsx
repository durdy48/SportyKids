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

const mockUseUser = vi.fn();
vi.mock('../../lib/user-context', () => ({
  useUser: () => mockUseUser(),
}));

const defaultColors = {
  background: '#F8FAFC', text: '#1E293B', muted: '#6B7280',
  surface: '#FFFFFF', border: '#E5E7EB', blue: '#2563EB',
};

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

    // If type is a function component, call it to get the rendered output
    if (typeof node.type === 'function') {
      try {
        const result = (node.type as (p: Record<string, unknown>) => unknown)(props);
        return serializeElement(result);
      } catch {
        return '';
      }
    }

    // For string/symbol types (native components or mocks), serialize props + children
    const propStr = Object.entries(props)
      .filter(([k]) => k !== 'children' && k !== 'style')
      .map(([k, v]) => (typeof v === 'string' ? `${k}=${v}` : typeof v === 'function' ? k : `${k}`))
      .join(' ');
    const children = props.children != null ? serializeElement(props.children) : '';
    return `<${propStr}>${children}</>`;
  }
  return '';
}

describe('UpgradeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: parent with free tier
    mockUseUser.mockReturnValue({
      user: { id: 'p1', name: 'Parent', role: 'parent', authProvider: 'email', subscriptionTier: 'free' },
      locale: 'es',
      colors: defaultColors,
    });
  });

  it('can be imported without errors', async () => {
    const mod = await import('../Upgrade');
    expect(mod.UpgradeScreen).toBeDefined();
    expect(typeof mod.UpgradeScreen).toBe('function');
  });

  describe('parent view', () => {
    it('renders upgrade title and pricing buttons', async () => {
      const { UpgradeScreen } = await import('../Upgrade');
      const tree = serializeElement({ type: UpgradeScreen, props: {} });
      expect(tree).toContain('subscription.upgrade');
      expect(tree).toContain('subscription.monthly');
      expect(tree).toContain('subscription.yearly');
      expect(tree).toContain('subscription.restore');
    });

    it('renders feature comparison table', async () => {
      const { UpgradeScreen } = await import('../Upgrade');
      const tree = serializeElement({ type: UpgradeScreen, props: {} });
      expect(tree).toContain('subscription.free');
      expect(tree).toContain('subscription.premium');
      expect(tree).toContain('subscription.feature_unlimited_news');
    });

    it('renders legal links', async () => {
      const { UpgradeScreen } = await import('../Upgrade');
      const tree = serializeElement({ type: UpgradeScreen, props: {} });
      expect(tree).toContain('legal.terms_of_service');
      expect(tree).toContain('legal.privacy_policy');
    });
  });

  describe('child view', () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({
        user: { id: 'c1', name: 'Child', role: 'child', authProvider: 'email', subscriptionTier: 'free' },
        locale: 'es',
        colors: defaultColors,
      });
    });

    it('renders child message and ask-parent button', async () => {
      const { UpgradeScreen } = await import('../Upgrade');
      const tree = serializeElement({ type: UpgradeScreen, props: {} });
      expect(tree).toContain('subscription.child_message');
      expect(tree).toContain('subscription.ask_parent');
    });
  });

  describe('anonymous view', () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({
        user: { id: 'a1', name: 'Anon', role: 'child', authProvider: 'anonymous', subscriptionTier: 'free' },
        locale: 'es',
        colors: defaultColors,
      });
    });

    it('renders create account prompt with register button', async () => {
      const { UpgradeScreen } = await import('../Upgrade');
      const tree = serializeElement({ type: UpgradeScreen, props: {} });
      expect(tree).toContain('subscription.create_account_first');
      expect(tree).toContain('auth.register');
    });
  });

  describe('premium view', () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({
        user: {
          id: 'p1', name: 'Parent', role: 'parent', authProvider: 'email',
          subscriptionTier: 'premium', subscriptionExpiry: new Date(Date.now() + 86400000).toISOString(),
        },
        locale: 'es',
        colors: defaultColors,
      });
    });

    it('renders manage subscription button', async () => {
      const { UpgradeScreen } = await import('../Upgrade');
      const tree = serializeElement({ type: UpgradeScreen, props: {} });
      expect(tree).toContain('subscription.manage');
      expect(tree).toContain('subscription.active_until');
    });
  });

  describe('accessibility', () => {
    it('renders accessibilityRole and accessibilityLabel on interactive elements', async () => {
      const { UpgradeScreen } = await import('../Upgrade');
      const tree = serializeElement({ type: UpgradeScreen, props: {} });
      expect(tree).toContain('accessibilityRole=button');
      expect(tree).toContain('accessibilityLabel');
    });
  });
});
