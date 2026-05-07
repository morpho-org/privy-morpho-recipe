import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVaultPosition } from '@/hooks/useVaultPosition';

const mockSendBatchTransaction = vi.fn();
const mockSendSingleTransaction = vi.fn();
const mockReadContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' });
const morphoMocks = vi.hoisted(() => {
  const mockWalletClient = {
    account: { address: '0x1234567890abcdef1234567890abcdef12345678' as const },
    sendTransaction: vi.fn(),
  };
  const mockSdkTx = {
    to: '0x9999999999999999999999999999999999999999' as `0x${string}`,
    data: '0x' as `0x${string}`,
    value: 0n,
  };
  const mockDepositAction = {
    getRequirements: vi.fn().mockResolvedValue([]),
    buildTx: vi.fn().mockReturnValue(mockSdkTx),
  };
  return {
    mockWalletClient,
    mockSdkTx,
    mockDepositAction,
    mockVaultEntity: {
      getData: vi.fn().mockResolvedValue({ address: '0x1111111111111111111111111111111111111111' }),
      deposit: vi.fn().mockReturnValue(mockDepositAction),
      redeem: vi.fn().mockReturnValue({ buildTx: vi.fn().mockReturnValue(mockSdkTx) }),
      withdraw: vi.fn().mockReturnValue({ buildTx: vi.fn().mockReturnValue(mockSdkTx) }),
    },
    mockSendBuiltTx: vi.fn().mockResolvedValue('0xsdkhash'),
    mockResolveRequirements: vi.fn().mockResolvedValue(undefined),
  };
});
const {
  mockWalletClient,
  mockSdkTx,
  mockDepositAction,
  mockVaultEntity,
  mockSendBuiltTx,
  mockResolveRequirements,
} = morphoMocks;

vi.mock('@/context/ChainContext', () => ({
  useChain: vi.fn(() => ({
    selectedChain: {
      id: 8453,
      name: 'Base',
      blockExplorers: { default: { url: 'https://basescan.org' } },
    },
  })),
}));

vi.mock('wagmi', () => ({
  useWalletClient: vi.fn(() => ({ data: morphoMocks.mockWalletClient })),
}));

vi.mock('@/hooks/useSmartAccount', () => ({
  useSmartAccount: vi.fn(() => ({
    sendBatchTransaction: mockSendBatchTransaction,
    sendSingleTransaction: mockSendSingleTransaction,
    address: '0x1234567890abcdef1234567890abcdef12345678',
    isReady: true,
  })),
}));

vi.mock('@/lib/morphoSdk', () => ({
  createMorphoClient: vi.fn(() => ({
    vaultV2: vi.fn(() => morphoMocks.mockVaultEntity),
  })),
  getWalletClientAddress: vi.fn(() => morphoMocks.mockWalletClient.account.address),
  resolveRequirements: morphoMocks.mockResolveRequirements,
  sendBuiltTx: morphoMocks.mockSendBuiltTx,
}));

vi.mock('@/hooks/usePublicClient', () => ({
  usePublicClient: vi.fn(() => ({
    readContract: mockReadContract,
    waitForTransactionReceipt: mockWaitForTransactionReceipt,
  })),
}));

const defaultVaultInfo = {
  selectedVaultAddress: '0x1111111111111111111111111111111111111111',
  assetDecimals: 6,
  assetSymbol: 'USDC',
  assetAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
  assetPriceUsd: 1.0,
  sharePriceUsd: 1.05,
};

describe('useVaultPosition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendBuiltTx.mockResolvedValue('0xsdkhash');
    mockResolveRequirements.mockResolvedValue(undefined);
    mockDepositAction.getRequirements.mockResolvedValue([]);
    mockDepositAction.buildTx.mockReturnValue(mockSdkTx);
    mockReadContract.mockResolvedValue(0n);
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));
    expect(result.current.depositAmount).toBe('');
    expect(result.current.withdrawAmount).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.status).toBe('');
  });

  it('fetches asset balance on mount', async () => {
    mockReadContract.mockResolvedValue(5_000_000n);

    renderHook(() => useVaultPosition(defaultVaultInfo));

    await waitFor(() => {
      expect(mockReadContract).toHaveBeenCalled();
    });
  });

  it('checkVaultSafety warns when dead shares below threshold', async () => {
    mockReadContract
      .mockResolvedValueOnce(1_000_000n) // asset balance
      .mockResolvedValueOnce(0n) // vault shares
      .mockResolvedValueOnce(100n); // dead address shares (below threshold)

    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));

    await waitFor(() => {
      expect(result.current.vaultSafetyWarning).toBeTruthy();
    });
  });

  it('checkVaultSafety clears warning when dead shares above threshold', async () => {
    mockReadContract
      .mockResolvedValueOnce(1_000_000n) // asset balance
      .mockResolvedValueOnce(0n) // vault shares
      .mockResolvedValueOnce(10n ** 10n); // dead address shares (above threshold)

    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));

    await waitFor(() => {
      expect(mockReadContract).toHaveBeenCalledTimes(3);
    });
    expect(result.current.vaultSafetyWarning).toBeNull();
  });

  it('handleDeposit validates amount', async () => {
    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));

    act(() => result.current.setDepositAmount(''));
    await act(async () => {
      await result.current.handleDeposit();
    });

    expect(result.current.status).toContain('enter an amount');
  });

  it('handleDeposit sends SDK-built transaction on valid amount', async () => {
    mockReadContract
      .mockResolvedValueOnce(10_000_000n) // initial asset balance
      .mockResolvedValueOnce(0n) // initial vault shares
      .mockResolvedValueOnce(10n ** 10n) // dead address check
      .mockResolvedValueOnce(1n * 10n ** 18n) // post-deposit vault shares
      .mockResolvedValueOnce(9_000_000n) // post-deposit asset balance
      .mockResolvedValueOnce(1_000_000n); // post-deposit vault assets

    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));

    await waitFor(() => {
      expect(mockReadContract).toHaveBeenCalled();
    });

    act(() => result.current.setDepositAmount('1'));

    await act(async () => {
      await result.current.handleDeposit();
    });

    expect(mockVaultEntity.deposit).toHaveBeenCalled();
    expect(mockResolveRequirements).toHaveBeenCalled();
    expect(mockSendBuiltTx).toHaveBeenCalledWith(mockWalletClient, mockSdkTx, expect.objectContaining({ id: 8453 }));
    expect(result.current.positionAssets).toBe(1_000_000n);
    expect(result.current.status).toContain('Your position is now $1.00');
  });

  it('handleWithdrawAll sends SDK-built transaction', async () => {
    mockReadContract
      .mockResolvedValueOnce(1_000_000n) // asset balance
      .mockResolvedValueOnce(5n * 10n ** 18n) // vault shares = 5 shares
      .mockResolvedValueOnce(10n ** 10n) // dead address check
      .mockResolvedValueOnce(5_250_000n) // vault assets
      .mockResolvedValueOnce(0n) // shares after withdrawal
      .mockResolvedValueOnce(6_250_000n) // asset balance after withdrawal
      .mockResolvedValue(0n); // subsequent calls

    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));

    await waitFor(() => {
      expect(result.current.shares).toBe(5n * 10n ** 18n);
    });

    await act(async () => {
      await result.current.handleWithdrawAll();
    });

    expect(mockVaultEntity.redeem).toHaveBeenCalled();
    expect(mockSendBuiltTx).toHaveBeenCalled();
  });

  it('handleWithdrawAmount validates input', async () => {
    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));

    act(() => result.current.setWithdrawAmount('abc'));
    await act(async () => {
      await result.current.handleWithdrawAmount();
    });

    expect(result.current.status).toContain('valid positive amount');
  });

  it('auto-clears status after 10 seconds', async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));

    act(() => result.current.setDepositAmount(''));
    await act(async () => {
      await result.current.handleDeposit();
    });

    expect(result.current.status).not.toBe('');

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.status).toBe('');
    vi.useRealTimers();
  });

  it('explorerUrl is derived from chain', () => {
    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));
    expect(result.current.explorerUrl).toBe('https://basescan.org');
  });
});
