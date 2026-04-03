import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from '@/components/Navbar';
import React from 'react';

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockSetSelectedChain = vi.fn();

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    ready: true,
    authenticated: false,
    login: mockLogin,
    logout: mockLogout,
  })),
}));

vi.mock('@/context/ChainContext', () => ({
  useChain: vi.fn(() => ({
    selectedChain: { id: 8453, name: 'Base' },
    supportedChains: [
      { id: 8453, name: 'Base' },
      { id: 1, name: 'Ethereum' },
    ],
    setSelectedChain: mockSetSelectedChain,
    isLoadingChains: false,
  })),
}));

const mockPathname = vi.fn(() => '/earn');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, ...props }, children),
}));

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/earn');
  });

  it('renders logo text', () => {
    render(<Navbar />);
    expect(screen.getByText(/Privy/)).toBeInTheDocument();
  });

  it('hides nav links on landing page', () => {
    mockPathname.mockReturnValue('/');
    render(<Navbar />);
    expect(screen.queryByText('Earn')).not.toBeInTheDocument();
    expect(screen.queryByText('Borrow')).not.toBeInTheDocument();
  });

  it('shows nav links on non-landing pages', () => {
    render(<Navbar />);
    expect(screen.getByText('Earn')).toBeInTheDocument();
    expect(screen.getByText('Borrow')).toBeInTheDocument();
  });

  it('highlights active link', () => {
    render(<Navbar />);
    const earnLink = screen.getByText('Earn');
    expect(earnLink.className).toContain('bg-accent');
  });

  it('renders chain selector with supported chains', () => {
    render(<Navbar />);
    expect(screen.getByLabelText('Select chain')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
  });

  it('shows Connect button when not authenticated', () => {
    render(<Navbar />);
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('calls login on Connect click', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    await user.click(screen.getByText('Connect'));
    expect(mockLogin).toHaveBeenCalled();
  });

  it('shows Disconnect when authenticated', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      ready: true,
      authenticated: true,
      login: mockLogin,
      logout: mockLogout,
    });

    render(<Navbar />);
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });
});
