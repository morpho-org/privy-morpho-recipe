import { vi } from 'vitest';

export const mockLogin = vi.fn();
export const mockLogout = vi.fn();

export const defaultPrivyState = {
  ready: true,
  authenticated: false,
  login: mockLogin,
  logout: mockLogout,
  user: null,
};

export const authenticatedPrivyState = {
  ...defaultPrivyState,
  authenticated: true,
  user: { id: 'test-user' },
};

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => defaultPrivyState),
  PrivyProvider: ({ children }: { children: React.ReactNode }) => children,
}));
