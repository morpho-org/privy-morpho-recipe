import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSmartAccount } from '@/hooks/useSmartAccount';

const mockSendTransaction = vi.fn();
const mockWaitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' });

vi.mock('@/context/ChainContext', () => ({
  useChain: vi.fn(() => ({
    selectedChain: { id: 8453, name: 'Base' },
  })),
}));

vi.mock('@/hooks/usePublicClient', () => ({
  usePublicClient: vi.fn(() => ({
    readContract: vi.fn(),
    waitForTransactionReceipt: mockWaitForTransactionReceipt,
  })),
}));

const mockWalletClient = {
  account: { address: '0x1234567890abcdef1234567890abcdef12345678' as const },
  sendTransaction: mockSendTransaction,
};

vi.mock('wagmi', () => ({
  useWalletClient: vi.fn(() => ({ data: mockWalletClient })),
  useAccount: vi.fn(() => ({ address: '0x1234567890abcdef1234567890abcdef12345678' })),
}));

describe('useSmartAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isReady is true when walletClient exists', () => {
    const { result } = renderHook(() => useSmartAccount());
    expect(result.current.isReady).toBe(true);
  });

  it('exposes wallet address', () => {
    const { result } = renderHook(() => useSmartAccount());
    expect(result.current.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('sendBatchTransaction sends sequential txs', async () => {
    mockSendTransaction.mockResolvedValueOnce('0xhash1').mockResolvedValueOnce('0xhash2');

    const { result } = renderHook(() => useSmartAccount());

    let response: { hash: string; wasBatched: boolean };
    await act(async () => {
      response = await result.current.sendBatchTransaction([
        { to: '0xaaa' as `0x${string}`, data: '0x01' as `0x${string}` },
        { to: '0xbbb' as `0x${string}`, data: '0x02' as `0x${string}` },
      ]);
    });

    expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    expect(mockWaitForTransactionReceipt).toHaveBeenCalledTimes(2);
    expect(response!.hash).toBe('0xhash2');
    expect(response!.wasBatched).toBe(false);
  });

  it('sendSingleTransaction sends direct tx', async () => {
    mockSendTransaction.mockResolvedValueOnce('0xsinglehash');

    const { result } = renderHook(() => useSmartAccount());

    let hash: string;
    await act(async () => {
      hash = await result.current.sendSingleTransaction({
        to: '0xaaa' as `0x${string}`,
        data: '0x01' as `0x${string}`,
      });
    });

    expect(hash!).toBe('0xsinglehash');
    expect(mockSendTransaction).toHaveBeenCalledTimes(1);
  });

  it('sendBatchTransaction throws when wallet not connected', async () => {
    const { useWalletClient } = await import('wagmi');
    (useWalletClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({ data: null });

    const { result } = renderHook(() => useSmartAccount());

    await expect(
      act(async () => {
        await result.current.sendBatchTransaction([
          { to: '0xaaa' as `0x${string}`, data: '0x01' as `0x${string}` },
        ]);
      }),
    ).rejects.toThrow('Wallet not connected');
  });

  it('sendSingleTransaction throws when wallet not connected', async () => {
    const { useWalletClient } = await import('wagmi');
    (useWalletClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({ data: null });

    const { result } = renderHook(() => useSmartAccount());

    await expect(
      act(async () => {
        await result.current.sendSingleTransaction({
          to: '0xaaa' as `0x${string}`,
          data: '0x01' as `0x${string}`,
        });
      }),
    ).rejects.toThrow('Wallet not connected');
  });
});
