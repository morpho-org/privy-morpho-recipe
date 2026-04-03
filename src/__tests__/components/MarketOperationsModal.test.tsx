import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarketOperationsModal from '@/components/MarketOperationsModal';
import { WAD, INFINITE_HEALTH_FACTOR } from '@/lib/constants';
import type { SimulationResult } from '@/lib/simulate';

const mockLogin = vi.fn();
const mockHandleBorrowExecute = vi.fn();
const mockHandleRepayExecute = vi.fn();
const mockHandleRepayAll = vi.fn();
const mockHandleWithdrawAllCollateral = vi.fn();
const mockFetchBalances = vi.fn();
const mockFetchPosition = vi.fn();

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    authenticated: false,
    login: mockLogin,
  })),
}));

vi.mock('@/hooks/useSmartAccount', () => ({
  useSmartAccount: vi.fn(() => ({
    isReady: true,
    address: '0x1234567890abcdef1234567890abcdef12345678',
  })),
}));

vi.mock('@/context/ChainContext', () => ({
  useChain: vi.fn(() => ({
    selectedChain: { id: 8453, name: 'Base' },
  })),
}));

const marketKey = '0x' + 'a1'.repeat(32);

// A simple simulation result for testing
const mockSimulation: SimulationResult = {
  current: {
    collateral: 10n ** 8n,
    collateralFormatted: '1.00000000',
    borrowed: 50000n * 10n ** 6n,
    borrowedFormatted: '50000.000000',
    ltv: (WAD * 50n) / 100n,
    ltvPercent: '50.0',
    hf: (WAD * 172n) / 100n,
    hfFormatted: '1.72',
    hfColor: 'text-yellow-400',
    liqPrice: 58139n * 10n ** 34n,
    liqPriceFormatted: '$58139.00',
  },
  projected: null,
  hasInput: false,
  isSafe: true,
  exceedsLltv: false,
  isLiquidatable: false,
};

vi.mock('@/hooks/useMarkets', () => ({
  useMarkets: vi.fn(() => ({
    markets: [],
    selectedMarketKey: marketKey,
    setSelectedMarketKey: vi.fn(),
    selectedMarket: {
      uniqueKey: marketKey,
      lltv: '860000000000000000',
      loanAsset: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
      collateralAsset: { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', decimals: 8 },
      oracleAddress: '0x' + 'cc'.repeat(20),
      irmAddress: '0x' + 'bb'.repeat(20),
      state: { borrowApy: 0.055 },
    },
    loanDecimals: 6,
    collateralDecimals: 8,
    loanSymbol: 'USDC',
    collateralSymbol: 'cbBTC',
    loanToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    collateralToken: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    oracleAddress: '0x' + 'cc'.repeat(20),
    marketLltv: (86n * WAD) / 100n,
    marketId: marketKey,
    marketParamsArg: {},
    lltvPercent: '86',
    loading: false,
    error: undefined,
  })),
}));

vi.mock('@/hooks/useMarketPosition', () => ({
  useMarketPosition: vi.fn(() => ({
    collateralAmount: '0.1',
    setCollateralAmount: vi.fn(),
    borrowAmount: '100',
    setBorrowAmount: vi.fn(),
    repayAmount: '100',
    setRepayAmount: vi.fn(),
    withdrawAmount: '0.05',
    setWithdrawAmount: vi.fn(),
    status: '',
    statusKind: 'idle',
    txHash: '',
    isLoading: false,
    explorerUrl: 'https://basescan.org',
    collateralBalance: 10n ** 8n,
    loanBalance: 100_000n * 10n ** 6n,
    position: {
      supplyShares: 0n,
      borrowShares: 50_000n * 10n ** 6n,
      collateral: 10n ** 8n,
    },
    healthFactor: (172n * WAD) / 100n,
    liquidationPrice: 58_139n * 10n ** 34n,
    oraclePrice: 60000n * 10n ** 34n,
    marketBorrowData: { totalAssets: 500000n * 10n ** 6n, totalShares: 500000n * 10n ** 6n },
    currentDebtAssets: 50000n * 10n ** 6n,
    maxRepayAmount: 100000,
    maxBorrowAmount: 1000,
    maxWithdrawCollateral: 1.0,
    simulation: mockSimulation,
    borrowValidation: { isValid: true, disabledReason: null, warnings: [] },
    repayValidation: { isValid: true, disabledReason: null, warnings: [] },
    borrowCtaLabel: 'Supply & Borrow',
    repayCtaLabel: 'Repay USDC',
    borrowTxSteps: [
      { label: 'Approve', description: 'Approve cbBTC to Morpho' },
      { label: 'Supply', description: 'Supply 0.1 cbBTC collateral' },
      { label: 'Borrow', description: 'Borrow 100 USDC' },
    ],
    repayTxSteps: [
      { label: 'Approve', description: 'Approve USDC to Morpho' },
      { label: 'Repay', description: 'Repay 100 USDC' },
    ],
    fetchBalances: mockFetchBalances,
    fetchPosition: mockFetchPosition,
    handleBorrowExecute: mockHandleBorrowExecute,
    handleRepayExecute: mockHandleRepayExecute,
    handleRepayAll: mockHandleRepayAll,
    handleWithdrawAllCollateral: mockHandleWithdrawAllCollateral,
  })),
}));

describe('MarketOperationsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows market info when unauthenticated', () => {
    render(<MarketOperationsModal marketKey={marketKey} />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('cbBTC')).toBeInTheDocument();
    expect(screen.getByText('86%')).toBeInTheDocument();
  });

  it('calls login on connect', async () => {
    const user = userEvent.setup();
    render(<MarketOperationsModal marketKey={marketKey} />);
    await user.click(screen.getByText('Connect Wallet'));
    expect(mockLogin).toHaveBeenCalled();
  });

  it('shows borrow/repay tabs when authenticated', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    render(<MarketOperationsModal marketKey={marketKey} />);
    expect(screen.getByText('Borrow')).toBeInTheDocument();
    expect(screen.getByText('Repay')).toBeInTheDocument();
  });

  it('shows current position data when authenticated', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    render(<MarketOperationsModal marketKey={marketKey} />);
    expect(screen.getByText('Your Position')).toBeInTheDocument();
    expect(screen.getByText('cbBTC Collateral')).toBeInTheDocument();
    expect(screen.getByText(/Debt/)).toBeInTheDocument();
    expect(screen.getByText('Health Factor')).toBeInTheDocument();
  });

  it('shows transaction steps on borrow tab', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    render(<MarketOperationsModal marketKey={marketKey} />);
    expect(screen.getByText('Transaction Steps')).toBeInTheDocument();
    expect(screen.getByText(/Approve cbBTC/)).toBeInTheDocument();
    expect(screen.getByText(/Supply 0.1 cbBTC/)).toBeInTheDocument();
    expect(screen.getByText(/Borrow 100 USDC/)).toBeInTheDocument();
  });

  it('shows single CTA button with dynamic label', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    render(<MarketOperationsModal marketKey={marketKey} />);
    expect(screen.getByText('Supply & Borrow')).toBeInTheDocument();
    // No "Borrow Only" button
    expect(screen.queryByText('Borrow Only')).not.toBeInTheDocument();
  });

  it('clicking CTA enters review mode', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    const user = userEvent.setup();
    render(<MarketOperationsModal marketKey={marketKey} />);

    await user.click(screen.getByText('Supply & Borrow'));
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getAllByText(/Back/).length).toBeGreaterThan(0);
  });

  it('shows repay tab with repay controls', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    const user = userEvent.setup();
    render(<MarketOperationsModal marketKey={marketKey} />);

    // Switch to repay tab
    const repayTab = screen.getAllByText('Repay')[0];
    await user.click(repayTab);

    // Should show repay label and CTA
    expect(screen.getAllByText('Repay USDC').length).toBeGreaterThanOrEqual(1);
  });

  it('shows status and explorer link when tx present', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    const { useMarketPosition } = await import('@/hooks/useMarketPosition');
    (useMarketPosition as ReturnType<typeof vi.fn>).mockReturnValue({
      collateralAmount: '0.1', setCollateralAmount: vi.fn(),
      borrowAmount: '100', setBorrowAmount: vi.fn(),
      repayAmount: '100', setRepayAmount: vi.fn(),
      withdrawAmount: '0.05', setWithdrawAmount: vi.fn(),
      status: 'Supply & Borrow successful!',
      statusKind: 'success',
      txHash: '0xabc123',
      isLoading: false, explorerUrl: 'https://basescan.org',
      collateralBalance: 10n ** 8n, loanBalance: 0n,
      position: { supplyShares: 0n, borrowShares: 0n, collateral: 0n },
      healthFactor: null, liquidationPrice: null,
      oraclePrice: null, marketBorrowData: null,
      currentDebtAssets: 0n,
      maxRepayAmount: null, maxBorrowAmount: null, maxWithdrawCollateral: null,
      simulation: null,
      borrowValidation: { isValid: false, disabledReason: 'Enter an amount', warnings: [] },
      repayValidation: { isValid: false, disabledReason: 'Enter an amount', warnings: [] },
      borrowCtaLabel: 'Enter amounts', repayCtaLabel: 'Enter amounts',
      borrowTxSteps: [], repayTxSteps: [],
      fetchBalances: mockFetchBalances, fetchPosition: mockFetchPosition,
      handleBorrowExecute: mockHandleBorrowExecute,
      handleRepayExecute: mockHandleRepayExecute,
      handleRepayAll: mockHandleRepayAll,
      handleWithdrawAllCollateral: mockHandleWithdrawAllCollateral,
    });

    render(<MarketOperationsModal marketKey={marketKey} />);
    expect(screen.getByText('Supply & Borrow successful!')).toBeInTheDocument();
    expect(screen.getByText('View Transaction')).toBeInTheDocument();
  });

  it('shows address when authenticated', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    render(<MarketOperationsModal marketKey={marketKey} />);
    expect(screen.getByText('0x1234567890abcdef1234567890abcdef12345678')).toBeInTheDocument();
  });

  it('shows LLTV in market header', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    render(<MarketOperationsModal marketKey={marketKey} />);
    expect(screen.getByText('(86% LLTV)')).toBeInTheDocument();
  });

  it('shows disabled reason when validation fails', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    const { useMarketPosition } = await import('@/hooks/useMarketPosition');
    (useMarketPosition as ReturnType<typeof vi.fn>).mockReturnValue({
      collateralAmount: '', setCollateralAmount: vi.fn(),
      borrowAmount: '', setBorrowAmount: vi.fn(),
      repayAmount: '', setRepayAmount: vi.fn(),
      withdrawAmount: '', setWithdrawAmount: vi.fn(),
      status: '', statusKind: 'idle', txHash: '',
      isLoading: false, explorerUrl: 'https://basescan.org',
      collateralBalance: null, loanBalance: null,
      position: null, healthFactor: null, liquidationPrice: null,
      oraclePrice: null, marketBorrowData: null,
      currentDebtAssets: 0n,
      maxRepayAmount: null, maxBorrowAmount: null, maxWithdrawCollateral: null,
      simulation: null,
      borrowValidation: { isValid: false, disabledReason: 'Add collateral to borrow', warnings: [] },
      repayValidation: { isValid: false, disabledReason: 'Enter an amount', warnings: [] },
      borrowCtaLabel: 'Enter amounts', repayCtaLabel: 'Enter amounts',
      borrowTxSteps: [], repayTxSteps: [],
      fetchBalances: mockFetchBalances, fetchPosition: mockFetchPosition,
      handleBorrowExecute: mockHandleBorrowExecute,
      handleRepayExecute: mockHandleRepayExecute,
      handleRepayAll: mockHandleRepayAll,
      handleWithdrawAllCollateral: mockHandleWithdrawAllCollateral,
    });

    render(<MarketOperationsModal marketKey={marketKey} />);
    expect(screen.getByText('Add collateral to borrow')).toBeInTheDocument();
  });
});
