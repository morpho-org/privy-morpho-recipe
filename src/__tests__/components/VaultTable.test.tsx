import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VaultTable from '@/components/VaultTable';
import { vaultsFixture } from '../fixtures/vaults';

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

// Filter out empty name vaults (matches hook logic)
const validVaults = vaultsFixture.filter((v) => v.name && v.name.trim() !== '');

describe('VaultTable', () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders vault rows with name, APY, deposits, curator', () => {
    render(<VaultTable vaults={validVaults as any} onSelect={onSelect} />);
    expect(screen.getByText('Gauntlet USDC Prime')).toBeInTheDocument();
    expect(screen.getByText('Steakhouse WETH')).toBeInTheDocument();
    expect(screen.getByText('Gauntlet')).toBeInTheDocument();
  });

  it('renders deposits in USD format', () => {
    render(<VaultTable vaults={validVaults as any} onSelect={onSelect} />);
    // totalAssetsUsd: 50M and 280M
    expect(screen.getAllByText('$50.0M').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$280.0M').length).toBeGreaterThan(0);
  });

  it('renders error state', () => {
    render(
      <VaultTable
        vaults={[]}
        onSelect={onSelect}
        error={{ message: 'Network error' }}
      />,
    );
    expect(screen.getByText(/Failed to load vaults/)).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<VaultTable vaults={[]} onSelect={onSelect} />);
    expect(screen.getByText('No vaults found.')).toBeInTheDocument();
  });

  it('calls onSelect when row clicked', async () => {
    const user = userEvent.setup();
    render(<VaultTable vaults={validVaults as any} onSelect={onSelect} />);

    await user.click(screen.getByText('Gauntlet USDC Prime'));
    expect(onSelect).toHaveBeenCalledWith(validVaults[0].address);
  });

  it('highlights selected row', () => {
    const { container } = render(
      <VaultTable
        vaults={validVaults as any}
        onSelect={onSelect}
        selectedAddress={validVaults[0].address}
      />,
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].className).toContain('bg-accent/10');
  });

  it('uses compact mode when selection active', () => {
    const { container } = render(
      <VaultTable
        vaults={validVaults as any}
        onSelect={onSelect}
        selectedAddress={validVaults[0].address}
      />,
    );
    // In compact mode, cells use text-xs
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].className).toContain('px-3');
  });

  it('renders loading skeleton when loading with no vaults', () => {
    const { container } = render(
      <VaultTable vaults={[]} onSelect={onSelect} loading={true} />,
    );
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders network name in each row', () => {
    render(<VaultTable vaults={validVaults as any} onSelect={onSelect} />);
    const baseLabels = screen.getAllByText('Base');
    expect(baseLabels.length).toBe(validVaults.length);
  });

  it('shows curator image when available', () => {
    const { container } = render(
      <VaultTable vaults={validVaults as any} onSelect={onSelect} />,
    );
    const images = container.querySelectorAll('img');
    expect(images.length).toBeGreaterThan(0);
  });
});
