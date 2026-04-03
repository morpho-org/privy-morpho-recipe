import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarketTable from '@/components/MarketTable';
import { marketsFixture } from '../fixtures/markets';

vi.mock('@/context/ChainContext', () => ({
  useChain: vi.fn(() => ({
    selectedChain: { id: 8453, name: 'Base' },
  })),
}));

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: Record<string, unknown>) => {
      const { initial, animate, transition, whileHover, whileTap, ...rest } = props;
      return <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children as React.ReactNode}</button>;
    },
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { initial, animate, transition, exit, ...rest } = props;
      return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children as React.ReactNode}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Filter out markets without collateral (matches hook logic)
const validMarkets = marketsFixture.filter((m) => m.collateralAsset !== null);

describe('MarketTable', () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders market rows with collateral/loan symbols', () => {
    render(<MarketTable markets={validMarkets as any} onSelect={onSelect} />);
    expect(screen.getByText('cbBTC')).toBeInTheDocument();
    expect(screen.getByText('WETH')).toBeInTheDocument();
  });

  it('renders loan symbols', () => {
    render(<MarketTable markets={validMarkets as any} onSelect={onSelect} />);
    const usdcCells = screen.getAllByText('USDC');
    expect(usdcCells.length).toBeGreaterThan(0);
    expect(screen.getByText('USDT')).toBeInTheDocument();
  });

  it('renders LLTV percentages', () => {
    render(<MarketTable markets={validMarkets as any} onSelect={onSelect} />);
    expect(screen.getByText('86.00%')).toBeInTheDocument();
    expect(screen.getByText('77.00%')).toBeInTheDocument();
  });

  it('renders utilization', () => {
    render(<MarketTable markets={validMarkets as any} onSelect={onSelect} />);
    expect(screen.getByText('50.00%')).toBeInTheDocument();
    expect(screen.getByText('33.30%')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(
      <MarketTable
        markets={[]}
        onSelect={onSelect}
        error={{ message: 'API down' }}
      />,
    );
    expect(screen.getByText(/Failed to load markets/)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<MarketTable markets={[]} onSelect={onSelect} />);
    expect(screen.getByText(/No markets found/)).toBeInTheDocument();
  });

  it('calls onSelect when row clicked', async () => {
    const user = userEvent.setup();
    render(<MarketTable markets={validMarkets as any} onSelect={onSelect} />);

    await user.click(screen.getByText('cbBTC'));
    expect(onSelect).toHaveBeenCalledWith(validMarkets[0].uniqueKey);
  });

  it('highlights selected row', () => {
    const { container } = render(
      <MarketTable
        markets={validMarkets as any}
        onSelect={onSelect}
        selectedKey={validMarkets[0].uniqueKey}
      />,
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].className).toContain('bg-accent/10');
  });

  it('renders loading skeleton', () => {
    const { container } = render(
      <MarketTable markets={[]} onSelect={onSelect} loading={true} />,
    );
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('uses compact mode when selection active', () => {
    const { container } = render(
      <MarketTable
        markets={validMarkets as any}
        onSelect={onSelect}
        selectedKey={validMarkets[0].uniqueKey}
      />,
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].className).toContain('px-3');
  });
});
