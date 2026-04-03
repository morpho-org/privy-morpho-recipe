import { vi } from 'vitest';

export const mockPush = vi.fn();
export const mockReplace = vi.fn();
export const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/earn'),
  useParams: vi.fn(() => ({})),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    // Return a component that lazily renders the loaded module
    const LazyComponent = (props: Record<string, unknown>) => {
      const Component = require('react').lazy(loader);
      return require('react').createElement(
        require('react').Suspense,
        { fallback: null },
        require('react').createElement(Component, props),
      );
    };
    return LazyComponent;
  },
}));
