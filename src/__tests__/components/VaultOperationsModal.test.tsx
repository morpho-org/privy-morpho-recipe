import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VaultOperationsModal from '@/components/VaultOperationsModal';
import React from 'react';

const mockLogin = vi.fn();
const mockHandleDeposit = vi.fn();
const mockHandleWithdrawAll = vi.fn();
const mockHandleWithdrawAmount = vi.fn();

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

const mockVault = {
  address: '0x1111111111111111111111111111111111111111',
  name: 'Gauntlet USDC Prime',
  symbol: 'gUSDCp',
  netApy: 0.0485,
  totalAssetsUsd: 50_000_000,
  asset: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, priceUsd: 1.0 },
  sharePrice: 1.05,
};

vi.mock('@/hooks/useVaults', () => ({
  useVaults: vi.fn(() => ({
    selectedVaultAddress: '0x1111111111111111111111111111111111111111',
    setSelectedVaultAddress: vi.fn(),
    selectedVault: mockVault,
    assetDecimals: 6,
    assetSymbol: 'USDC',
    assetAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    sharePriceUsd: 1.05,
    assetPriceUsd: 1.0,
    vaults: [mockVault],
    loading: false,
    error: undefined,
  })),
}));

vi.mock('@/hooks/useVaultPosition', () => ({
  useVaultPosition: vi.fn(() => ({
    depositAmount: '1',
    setDepositAmount: vi.fn(),
    withdrawAmount: '100',
    setWithdrawAmount: vi.fn(),
    status: '',
    statusKind: 'idle',
    txHash: '',
    shares: 5n * 10n ** 18n,
    assetBalance: 1_000_000n,
    isLoading: false,
    vaultSafetyWarning: null,
    maxWithdrawUsd: 5.25,
    explorerUrl: 'https://basescan.org',
    handleDeposit: mockHandleDeposit,
    handleWithdrawAll: mockHandleWithdrawAll,
    handleWithdrawAmount: mockHandleWithdrawAmount,
  })),
}));

describe('VaultOperationsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows vault name and asset when unauthenticated', () => {
    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);
    expect(screen.getByText('Gauntlet USDC Prime')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows Connect Wallet button when unauthenticated', async () => {
    const user = userEvent.setup();
    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);

    await user.click(screen.getByText('Connect Wallet'));
    expect(mockLogin).toHaveBeenCalled();
  });

  it('shows vault info when unauthenticated', () => {
    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  it('shows deposit/withdraw tabs when authenticated', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);
    // "Deposit" appears multiple times (tab, label, button)
    expect(screen.getAllByText('Deposit').length).toBeGreaterThan(0);
    expect(screen.getByText('Withdraw')).toBeInTheDocument();
  });

  it('shows position and wallet balance when authenticated', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);
    expect(screen.getByText('Your Position')).toBeInTheDocument();
    expect(screen.getByText('Position Value')).toBeInTheDocument();
    expect(screen.getByText('Wallet Balance')).toBeInTheDocument();
  });

  it('shows APY in the header', () => {
    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);
    // APY appears in header + deposit preview, so use getAllByText
    expect(screen.getAllByText(/4\.85%/).length).toBeGreaterThan(0);
  });

  it('shows address when authenticated', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);
    expect(screen.getByText('0x1234567890abcdef1234567890abcdef12345678')).toBeInTheDocument();
  });

  it('shows deposit CTA with dynamic label', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);
    // CTA shows "Deposit USDC" when amount is entered (label + CTA button)
    expect(screen.getAllByText('Deposit USDC').length).toBeGreaterThanOrEqual(1);
  });

  it('clicking CTA enters review mode then confirm calls handleDeposit', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    const user = userEvent.setup();
    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);

    // Click the CTA button (not the label)
    const ctaButton = screen.getAllByText('Deposit USDC').find(el => el.tagName === 'BUTTON');
    expect(ctaButton).toBeDefined();
    await user.click(ctaButton!);
    // Review mode should appear
    expect(screen.getByText('Review Transaction')).toBeInTheDocument();
    // Confirm calls handleDeposit
    await user.click(screen.getByText('Confirm'));
    expect(mockHandleDeposit).toHaveBeenCalled();
  });

  it('shows status when present', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    const { useVaultPosition } = await import('@/hooks/useVaultPosition');
    (useVaultPosition as ReturnType<typeof vi.fn>).mockReturnValue({
      depositAmount: '1',
      setDepositAmount: vi.fn(),
      withdrawAmount: '100',
      setWithdrawAmount: vi.fn(),
      status: 'Deposit successful!',
      statusKind: 'success',
      txHash: '0xabc',
      shares: 5n * 10n ** 18n,
      assetBalance: 1_000_000n,
      isLoading: false,
      vaultSafetyWarning: null,
      maxWithdrawUsd: 5.25,
      explorerUrl: 'https://basescan.org',
      handleDeposit: mockHandleDeposit,
      handleWithdrawAll: mockHandleWithdrawAll,
      handleWithdrawAmount: mockHandleWithdrawAmount,
    });

    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);
    expect(screen.getByText('Deposit successful!')).toBeInTheDocument();
    expect(screen.getByText('View Transaction')).toBeInTheDocument();
  });

  it('shows vault safety warning when present', async () => {
    const { usePrivy } = await import('@privy-io/react-auth');
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
      login: mockLogin,
    });

    const { useVaultPosition } = await import('@/hooks/useVaultPosition');
    (useVaultPosition as ReturnType<typeof vi.fn>).mockReturnValue({
      depositAmount: '1',
      setDepositAmount: vi.fn(),
      withdrawAmount: '100',
      setWithdrawAmount: vi.fn(),
      status: '',
      statusKind: 'idle',
      txHash: '',
      shares: 0n,
      assetBalance: 0n,
      isLoading: false,
      vaultSafetyWarning: 'This vault has insufficient dead deposit',
      maxWithdrawUsd: 0,
      explorerUrl: 'https://basescan.org',
      handleDeposit: mockHandleDeposit,
      handleWithdrawAll: mockHandleWithdrawAll,
      handleWithdrawAmount: mockHandleWithdrawAmount,
    });

    render(<VaultOperationsModal vaultAddress="0x1111111111111111111111111111111111111111" />);
    expect(screen.getByText(/insufficient dead deposit/)).toBeInTheDocument();
  });
});
