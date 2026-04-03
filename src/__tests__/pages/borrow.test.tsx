import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { Suspense } from 'react';
import { marketsFixture } from '../fixtures/markets';

const mockPush = vi.fn();
const mockSetSelectedChain = vi.fn();
const validMarkets = marketsFixture.filter((m) => m.collateralAsset !== null);

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/borrow'),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    return function DynamicComponent(props: Record<string, unknown>) {
      return React.createElement('div', { 'data-testid': 'market-operations-modal' }, `MarketOps: ${props.marketKey}`);
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

vi.mock('@/hooks/useMarkets', () => ({
  useMarkets: vi.fn(() => ({
    markets: validMarkets,
    loading: false,
    error: undefined,
    selectedMarketKey: '',
    setSelectedMarketKey: vi.fn(),
    selectedMarket: undefined,
    loanDecimals: 6,
    collateralDecimals: 8,
    loanSymbol: 'USDC',
    collateralSymbol: 'cbBTC',
    loanToken: undefined,
    collateralToken: undefined,
    oracleAddress: undefined,
    marketLltv: 0n,
    marketId: '' as `0x${string}`,
    marketParamsArg: null,
    lltvPercent: '0',
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

import BorrowPage from '@/app/borrow/[[...params]]/page';

async function renderBorrowPage(segments?: string[]) {
  const paramsPromise = Promise.resolve({ params: segments });
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      React.createElement(
        Suspense,
        { fallback: React.createElement('div', null, 'Loading...') },
        React.createElement(BorrowPage, { params: paramsPromise } as any),
      ),
    );
  });
  return result!;
}

describe('BorrowPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders MarketTable with market data', async () => {
    await renderBorrowPage();
    expect(screen.getByText('cbBTC')).toBeInTheDocument();
    expect(screen.getByText('WETH')).toBeInTheDocument();
  });

  it('renders page title', async () => {
    await renderBorrowPage();
    expect(screen.getByText(/Top 50 Available Morpho Markets/)).toBeInTheDocument();
  });

  it('clicking a market updates URL', async () => {
    const user = userEvent.setup();
    await renderBorrowPage();

    await user.click(screen.getByText('cbBTC'));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/borrow/8453/'),
      expect.anything(),
    );
  });

  it('URL with market key pre-opens side panel', async () => {
    await renderBorrowPage(['8453', validMarkets[0].uniqueKey]);
    expect(screen.getByText('Market Details')).toBeInTheDocument();
    expect(screen.getByTestId('market-operations-modal')).toBeInTheDocument();
  });

  it('close button navigates to /borrow', async () => {
    const user = userEvent.setup();
    await renderBorrowPage(['8453', validMarkets[0].uniqueKey]);

    await user.click(screen.getByText('Close'));
    expect(mockPush).toHaveBeenCalledWith('/borrow', expect.anything());
  });

  it('table and panel both render when market selected', async () => {
    await renderBorrowPage(['8453', validMarkets[0].uniqueKey]);
    expect(screen.getByText('cbBTC')).toBeInTheDocument();
    expect(screen.getByText('Market Details')).toBeInTheDocument();
  });
});
