import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVaultPosition } from '@/hooks/useVaultPosition';

const mockSendBatchTransaction = vi.fn();
const mockSendSingleTransaction = vi.fn();
const mockReadContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' });

vi.mock('@/context/ChainContext', () => ({
  useChain: vi.fn(() => ({
    selectedChain: {
      id: 8453,
      name: 'Base',
      blockExplorers: { default: { url: 'https://basescan.org' } },
    },
  })),
}));

vi.mock('@/hooks/useSmartAccount', () => ({
  useSmartAccount: vi.fn(() => ({
    sendBatchTransaction: mockSendBatchTransaction,
    sendSingleTransaction: mockSendSingleTransaction,
    address: '0x1234567890abcdef1234567890abcdef12345678',
    isReady: true,
  })),
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

  it('handleDeposit calls sendBatchTransaction on valid amount', async () => {
    mockReadContract.mockResolvedValue(10_000_000n);
    mockSendBatchTransaction.mockResolvedValue({ hash: '0xdeposithash', wasBatched: false });

    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));

    await waitFor(() => {
      expect(mockReadContract).toHaveBeenCalled();
    });

    act(() => result.current.setDepositAmount('1'));

    await act(async () => {
      await result.current.handleDeposit();
    });

    expect(mockSendBatchTransaction).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ to: defaultVaultInfo.assetAddress }),
      ]),
    );
  });

  it('handleWithdrawAll calls sendSingleTransaction', async () => {
    mockReadContract
      .mockResolvedValueOnce(1_000_000n) // asset balance
      .mockResolvedValueOnce(5n * 10n ** 18n) // vault shares = 5 shares
      .mockResolvedValueOnce(10n ** 10n) // dead address check
      .mockResolvedValue(0n); // subsequent calls
    mockSendSingleTransaction.mockResolvedValue('0xwithdrawhash');

    const { result } = renderHook(() => useVaultPosition(defaultVaultInfo));

    await waitFor(() => {
      expect(result.current.shares).toBe(5n * 10n ** 18n);
    });

    await act(async () => {
      await result.current.handleWithdrawAll();
    });

    expect(mockSendSingleTransaction).toHaveBeenCalled();
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
