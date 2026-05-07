import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMarketPosition } from '@/hooks/useMarketPosition';
import { WAD, INFINITE_HEALTH_FACTOR } from '@/lib/constants';

const mockSendBatchTransaction = vi.fn();
const mockSendSingleTransaction = vi.fn();
const mockReadContract = vi.fn();
const mockMulticall = vi.fn();
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
  const sdkAction = () => ({
    getRequirements: vi.fn().mockResolvedValue([]),
    buildTx: vi.fn().mockReturnValue(mockSdkTx),
  });
  const mockSdkPosition = {
    supplyShares: 0n,
    borrowShares: 50_000n * 10n ** 6n,
    borrowAssets: 50_000n * 10n ** 6n,
    collateral: 1n * 10n ** 8n,
  };
  return {
    mockWalletClient,
    mockSdkTx,
    mockSdkPosition,
    mockSdkMarket: {
      getPositionData: vi.fn().mockResolvedValue(mockSdkPosition),
      supplyCollateral: vi.fn(() => sdkAction()),
      supplyCollateralBorrow: vi.fn(() => sdkAction()),
      borrow: vi.fn(() => sdkAction()),
      repay: vi.fn(() => sdkAction()),
      repayWithdrawCollateral: vi.fn(() => sdkAction()),
      withdrawCollateral: vi.fn(() => ({ buildTx: vi.fn().mockReturnValue(mockSdkTx) })),
    },
    mockSendBuiltTx: vi.fn().mockResolvedValue('0xsdkhash'),
    mockResolveRequirements: vi.fn().mockResolvedValue(undefined),
  };
});
const {
  mockSdkPosition,
  mockSdkMarket,
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
    marketV1: vi.fn(() => morphoMocks.mockSdkMarket),
  })),
  getWalletClientAddress: vi.fn(() => morphoMocks.mockWalletClient.account.address),
  resolveRequirements: morphoMocks.mockResolveRequirements,
  sendBuiltTx: morphoMocks.mockSendBuiltTx,
}));

vi.mock('@/hooks/usePublicClient', () => ({
  usePublicClient: vi.fn(() => ({
    readContract: mockReadContract,
    multicall: mockMulticall,
    waitForTransactionReceipt: mockWaitForTransactionReceipt,
  })),
}));

/** Helper: wrap values in multicall result format */
function multicallResults(...values: unknown[]) {
  return values.map((result) => ({ status: 'success', result }));
}

const marketParams = {
  loanToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
  collateralToken: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' as `0x${string}`,
  oracle: '0x' + 'cc'.repeat(20) as `0x${string}`,
  irm: '0x' + 'bb'.repeat(20) as `0x${string}`,
  lltv: (86n * WAD) / 100n,
};

const defaultMarketInfo = {
  marketId: ('0x' + 'a1'.repeat(32)) as `0x${string}`,
  marketParamsArg: marketParams,
  loanToken: marketParams.loanToken,
  collateralToken: marketParams.collateralToken,
  oracleAddress: marketParams.oracle,
  marketLltv: marketParams.lltv,
  loanDecimals: 6,
  collateralDecimals: 8,
  loanSymbol: 'USDC',
  collateralSymbol: 'cbBTC',
  selectedMarketKey: '0x' + 'a1'.repeat(32),
  activeTab: 'borrow' as const,
};

/** Default multicall: balances returns zeros, position returns zeros */
function setupDefaultMulticall() {
  mockMulticall
    // fetchBalances multicall
    .mockResolvedValueOnce(multicallResults(0n, 0n, 0n, 0n))
    // fetchPosition multicall
    .mockResolvedValueOnce(multicallResults(
      [0n, 0n, 0n], // position
      [0n, 0n, 0n, 0n, 0n, 0n], // market
      0n, // oracle price
    ));
}

describe('useMarketPosition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendBuiltTx.mockResolvedValue('0xsdkhash');
    mockResolveRequirements.mockResolvedValue(undefined);
    mockSdkMarket.getPositionData.mockResolvedValue(mockSdkPosition);
    mockReadContract.mockResolvedValue(0n);
    // Default multicall returns zeros — tests override as needed
    mockMulticall.mockResolvedValue(multicallResults(0n, 0n, 0n, 0n));
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    expect(result.current.collateralAmount).toBe('');
    expect(result.current.borrowAmount).toBe('');
    expect(result.current.repayAmount).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.position).toBeNull();
    expect(result.current.healthFactor).toBeNull();
  });

  it('fetches balances on mount', async () => {
    setupDefaultMulticall();
    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));

    await waitFor(() => {
      expect(mockMulticall).toHaveBeenCalled();
    });
  });

  it('fetchPosition reads position and computes health factor with debt', async () => {
    const collateral = 1n * 10n ** 8n; // 1 cbBTC
    const borrowShares = 50_000n * 10n ** 6n;
    const oraclePrice = 60000n * 10n ** 34n;
    const totalBorrowAssets = 500_000n * 10n ** 6n;
    const totalBorrowShares = 500_000n * 10n ** 6n;

    mockMulticall
      // fetchBalances
      .mockResolvedValueOnce(multicallResults(
        5n * 10n ** 7n, // collateral balance
        100_000n * 10n ** 6n, // loan balance
        0n, // collateral allowance
        0n, // loan allowance
      ))
      // fetchPosition
      .mockResolvedValueOnce(multicallResults(
        [0n, borrowShares, collateral],
        [0n, 0n, totalBorrowAssets, totalBorrowShares, 0n, 0n],
        oraclePrice,
      ));

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));

    await waitFor(() => {
      expect(result.current.position).not.toBeNull();
    });

    await waitFor(() => {
      expect(result.current.healthFactor).not.toBeNull();
    });

    expect(result.current.healthFactor!).toBeGreaterThan(WAD);
    expect(result.current.liquidationPrice).not.toBeNull();
    expect(result.current.liquidationPrice!).toBeGreaterThan(0n);
  });

  it('health factor is null when no debt', async () => {
    mockMulticall
      // fetchBalances
      .mockResolvedValueOnce(multicallResults(
        5n * 10n ** 7n, 100_000n * 10n ** 6n, 0n, 0n,
      ))
      // fetchPosition
      .mockResolvedValueOnce(multicallResults(
        [0n, 0n, 1n * 10n ** 8n], // position with no debt
        [0n, 0n, 0n, 0n, 0n, 0n],
        60000n * 10n ** 34n,
      ));

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));

    await waitFor(() => {
      expect(result.current.position).not.toBeNull();
    });

    expect(result.current.position!.borrowShares).toBe(0n);
    expect(result.current.healthFactor).toBeNull();
  });

  it('handleBorrowExecute with only collateral sends SDK supply tx', async () => {
    mockMulticall
      .mockResolvedValueOnce(multicallResults(10n ** 8n, 10n ** 8n, 0n, 0n))
      .mockResolvedValueOnce(multicallResults([0n, 0n, 0n], [0n, 0n, 0n, 0n, 0n, 0n], 0n))
      // post-tx fetches
      .mockResolvedValue(multicallResults(0n, 0n, 0n, 0n));

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    await waitFor(() => expect(mockMulticall).toHaveBeenCalled());

    act(() => {
      result.current.setCollateralAmount('0.1');
      result.current.setBorrowAmount('0'); // no borrow
    });
    await act(async () => {
      await result.current.handleBorrowExecute();
    });

    expect(mockSdkMarket.supplyCollateral).toHaveBeenCalled();
    expect(mockSendBuiltTx).toHaveBeenCalled();
    expect(result.current.status).toContain('collateral supplied');
  });

  it('handleBorrowExecute with both amounts uses SDK supply & borrow', async () => {
    mockMulticall
      .mockResolvedValueOnce(multicallResults(10n ** 8n, 10n ** 8n, 0n, 0n))
      .mockResolvedValueOnce(multicallResults([0n, 0n, 0n], [0n, 0n, 0n, 0n, 0n, 0n], 0n))
      // post-tx fetches
      .mockResolvedValue(multicallResults(0n, 0n, 0n, 0n));

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    await waitFor(() => expect(mockMulticall).toHaveBeenCalled());

    act(() => {
      result.current.setCollateralAmount('0.1');
      result.current.setBorrowAmount('100');
    });

    await act(async () => {
      await result.current.handleBorrowExecute();
    });

    expect(mockSdkMarket.supplyCollateralBorrow).toHaveBeenCalled();
    expect(mockSendBuiltTx).toHaveBeenCalled();
  });

  it('handleBorrowExecute with borrow only uses SDK borrow', async () => {
    setupDefaultMulticall();

    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));

    act(() => {
      result.current.setCollateralAmount('0');
      result.current.setBorrowAmount('100');
    });
    await act(async () => {
      await result.current.handleBorrowExecute();
    });

    expect(mockSdkMarket.borrow).toHaveBeenCalled();
    expect(mockSendBuiltTx).toHaveBeenCalled();
  });

  it('handleRepayExecute uses SDK repay', async () => {
    mockMulticall
      .mockResolvedValueOnce(multicallResults(0n, 100_000n * 10n ** 6n, 0n, 0n))
      .mockResolvedValueOnce(multicallResults([0n, 0n, 0n], [0n, 0n, 0n, 0n, 0n, 0n], 0n))
      // post-tx fetches
      .mockResolvedValue(multicallResults(0n, 0n, 0n, 0n));

    const { result } = renderHook(() => useMarketPosition({
      ...defaultMarketInfo,
      activeTab: 'repay',
    }));
    await waitFor(() => expect(mockMulticall).toHaveBeenCalled());

    act(() => result.current.setRepayAmount('100'));
    await act(async () => {
      await result.current.handleRepayExecute();
    });

    expect(mockSdkMarket.repay).toHaveBeenCalled();
    expect(mockSendBuiltTx).toHaveBeenCalled();
  });

  it('handleRepayAll reads SDK position and repays by shares', async () => {
    const borrowShares = 50_000n * 10n ** 6n;
    const totalBorrowAssets = 500_000n * 10n ** 6n;
    const totalBorrowShares = 500_000n * 10n ** 6n;

    mockMulticall
      // initial fetchBalances
      .mockResolvedValueOnce(multicallResults(0n, 0n, 0n, 0n))
      // initial fetchPosition
      .mockResolvedValueOnce(multicallResults(
        [0n, 0n, 0n],
        [0n, 0n, totalBorrowAssets, totalBorrowShares, 0n, 0n],
        60000n * 10n ** 34n,
      ))
      // post-tx fetches
      .mockResolvedValue(multicallResults(0n, 0n, 0n, 0n));

    mockSdkMarket.getPositionData.mockResolvedValueOnce({
      ...mockSdkPosition,
      borrowShares,
      borrowAssets: 50_000n * 10n ** 6n,
    });

    const { result } = renderHook(() => useMarketPosition({
      ...defaultMarketInfo,
      activeTab: 'repay',
    }));
    await waitFor(() => expect(mockMulticall).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleRepayAll();
    });

    expect(mockSdkMarket.repay).toHaveBeenCalledWith(expect.objectContaining({ shares: borrowShares }));
    expect(mockSendBuiltTx).toHaveBeenCalled();
    expect(result.current.status).toContain('All debt repaid');
  });

  it('handleRepayAll with zero borrowShares sets "No debt" status', async () => {
    const totalBorrowAssets = 500_000n * 10n ** 6n;
    const totalBorrowShares = 500_000n * 10n ** 6n;

    mockMulticall
      .mockResolvedValueOnce(multicallResults(0n, 0n, 0n, 0n))
      .mockResolvedValueOnce(multicallResults(
        [0n, 0n, 0n],
        [0n, 0n, totalBorrowAssets, totalBorrowShares, 0n, 0n],
        60000n * 10n ** 34n,
      ))
      .mockResolvedValue(multicallResults(0n, 0n, 0n, 0n));

    mockSdkMarket.getPositionData.mockResolvedValueOnce({
      ...mockSdkPosition,
      borrowShares: 0n,
      borrowAssets: 0n,
    });

    const { result } = renderHook(() => useMarketPosition({
      ...defaultMarketInfo,
      activeTab: 'repay',
    }));
    await waitFor(() => expect(mockMulticall).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleRepayAll();
    });

    expect(result.current.status).toContain('No debt');
  });

  it('exposes simulation and validation results', () => {
    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    expect(result.current.simulation).toBeNull(); // null before data loads
    expect(result.current.borrowValidation).toBeDefined();
    expect(result.current.borrowValidation.isValid).toBe(false); // no amounts entered
    expect(result.current.borrowCtaLabel).toBe('Enter amounts');
    expect(result.current.borrowTxSteps).toEqual([]);
  });

  it('explorerUrl is derived from chain', () => {
    const { result } = renderHook(() => useMarketPosition(defaultMarketInfo));
    expect(result.current.explorerUrl).toBe('https://basescan.org');
  });
});
