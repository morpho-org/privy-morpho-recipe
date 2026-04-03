import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { Suspense } from 'react';
import { vaultsFixture } from '../fixtures/vaults';

const mockPush = vi.fn();
const mockSetSelectedChain = vi.fn();
const validVaults = vaultsFixture.filter((v) => v.name && v.name.trim() !== '');

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/earn'),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    return function DynamicComponent(props: Record<string, unknown>) {
      return React.createElement('div', { 'data-testid': 'vault-operations-modal' }, `VaultOps: ${props.vaultAddress}`);
    };
  },
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
  ChainProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/useVaults', () => ({
  useVaults: vi.fn(() => ({
    vaults: validVaults,
    loading: false,
    error: undefined,
    selectedVaultAddress: '',
    setSelectedVaultAddress: vi.fn(),
    selectedVault: undefined,
    assetDecimals: 6,
    assetSymbol: 'Token',
    assetAddress: undefined,
    sharePriceUsd: null,
    assetPriceUsd: null,
  })),
}));

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: Record<string, unknown>) => {
      const { initial, animate, transition, whileHover, whileTap, ...rest } = props;
      return React.createElement('button', rest as React.ButtonHTMLAttributes<HTMLButtonElement>, children as React.ReactNode);
    },
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { initial, animate, transition, exit, ...rest } = props;
      return React.createElement('div', rest as React.HTMLAttributes<HTMLDivElement>, children as React.ReactNode);
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

import EarnPage from '@/app/earn/[[...params]]/page';

async function renderEarnPage(segments?: string[]) {
  const paramsPromise = Promise.resolve({ params: segments });
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      React.createElement(
        Suspense,
        { fallback: React.createElement('div', null, 'Loading...') },
        React.createElement(EarnPage, { params: paramsPromise } as any),
      ),
    );
  });
  return result!;
}

describe('EarnPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders VaultTable with vault data', async () => {
    await renderEarnPage();
    expect(screen.getByText('Gauntlet USDC Prime')).toBeInTheDocument();
    expect(screen.getByText('Steakhouse WETH')).toBeInTheDocument();
  });

  it('renders page title', async () => {
    await renderEarnPage();
    expect(screen.getByText(/Top 20 Available Morpho Vaults/)).toBeInTheDocument();
  });

  it('clicking a vault updates URL', async () => {
    const user = userEvent.setup();
    await renderEarnPage();

    await user.click(screen.getByText('Gauntlet USDC Prime'));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/earn/8453/'),
      expect.anything(),
    );
  });

  it('URL with vault address pre-opens side panel', async () => {
    await renderEarnPage(['8453', validVaults[0].address]);
    expect(screen.getByText('Vault Details')).toBeInTheDocument();
    expect(screen.getByTestId('vault-operations-modal')).toBeInTheDocument();
  });

  it('close button navigates to /earn', async () => {
    const user = userEvent.setup();
    await renderEarnPage(['8453', validVaults[0].address]);

    await user.click(screen.getByText('Close'));
    expect(mockPush).toHaveBeenCalledWith('/earn', expect.anything());
  });

  it('table and panel both render when vault selected', async () => {
    await renderEarnPage(['8453', validVaults[0].address]);
    // Verify both table and panel rendered
    expect(screen.getByText('Gauntlet USDC Prime')).toBeInTheDocument();
    expect(screen.getByText('Vault Details')).toBeInTheDocument();
  });
});
