'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MarketParams } from '@morpho-org/blue-sdk';
import type { RequirementSignature, Transaction } from '@morpho-org/morpho-sdk';
import { useWalletClient } from 'wagmi';
import { base } from 'viem/chains';

import {
  MORPHO_CORE_ADDRESS,
  ERC20_ABI,
  MORPHO_CORE_ABI,
  MORPHO_ORACLE_ABI,
  BORROW_SAFETY_BUFFER,
} from '@/lib/constants';

import {
  computeHealthFactor,
  computeLiquidationPrice,
  computeMaxBorrow,
  toAssetsUp,
} from '@/lib/morphoMath';

import {
  formatTokenAmount,
  parseTokenAmount,
  isZero,
  validateAmount,
} from '@/lib/utils';

import { simulatePosition, type SimulationResult } from '@/lib/simulate';
import {
  validateBorrowAction,
  validateRepayAction,
  type ValidationResult,
} from '@/lib/validation';

import { useSmartAccount } from '@/hooks/useSmartAccount';
import { usePublicClient } from '@/hooks/usePublicClient';
import { useTxLifecycle } from '@/hooks/useTxLifecycle';
import { useChain } from '@/context/ChainContext';
import { withRetry } from '@/lib/retry';
import {
  createMorphoClient,
  getWalletClientAddress,
  type MorphoRequirement,
  resolveRequirements,
  sendBuiltTx,
} from '@/lib/morphoSdk';

export interface TxStep {
  label: string;
  description: string;
}

interface MarketInfo {
  marketId: `0x${string}`;
  marketParamsArg: {
    loanToken: `0x${string}`;
    collateralToken: `0x${string}`;
    oracle: `0x${string}`;
    irm: `0x${string}`;
    lltv: bigint;
  } | null;
  loanToken: `0x${string}` | undefined;
  collateralToken: `0x${string}` | undefined;
  oracleAddress: `0x${string}` | undefined;
  marketLltv: bigint;
  loanDecimals: number;
  collateralDecimals: number;
  loanSymbol: string;
  collateralSymbol: string;
  selectedMarketKey: string;
  activeTab: 'borrow' | 'repay';
}

export function useMarketPosition(market: MarketInfo) {
  const { isReady, address } = useSmartAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { selectedChain } = useChain();

  const {
    marketId,
    marketParamsArg,
    loanToken,
    collateralToken,
    oracleAddress,
    marketLltv,
    loanDecimals,
    collateralDecimals,
    loanSymbol,
    collateralSymbol,
    selectedMarketKey,
    activeTab,
  } = market;

  const { status, statusKind, setStatus, txHash, isLoading, executeTx, resetTxState } = useTxLifecycle();

  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [collateralBalance, setCollateralBalance] = useState<bigint | null>(null);
  const [loanBalance, setLoanBalance] = useState<bigint | null>(null);
  const [position, setPosition] = useState<{
    supplyShares: bigint;
    borrowShares: bigint;
    collateral: bigint;
  } | null>(null);
  const [healthFactor, setHealthFactor] = useState<bigint | null>(null);
  const [liquidationPrice, setLiquidationPrice] = useState<bigint | null>(null);
  const [oraclePrice, setOraclePrice] = useState<bigint | null>(null);
  const [marketBorrowData, setMarketBorrowData] = useState<{ totalAssets: bigint; totalShares: bigint } | null>(null);

  // Allowance state
  const [collateralAllowance, setCollateralAllowance] = useState<bigint | null>(null);
  const [loanAllowance, setLoanAllowance] = useState<bigint | null>(null);

  const explorerUrl = selectedChain.blockExplorers?.default?.url ?? '';
  const isConnected = !!(address && isReady);

  // --- Computed values ---

  const currentDebtAssets = useMemo(() => {
    if (!position || position.borrowShares === 0n || !marketBorrowData) return 0n;
    return toAssetsUp(position.borrowShares, marketBorrowData.totalAssets, marketBorrowData.totalShares);
  }, [position, marketBorrowData]);

  const maxRepayAmount = (loanBalance !== null && loanBalance > 0n)
    ? parseFloat(formatTokenAmount(loanBalance, loanDecimals))
    : null;

  const maxWithdrawCollateral = (position && position.collateral > 0n)
    ? parseFloat(formatTokenAmount(position.collateral, collateralDecimals))
    : null;

  const maxBorrowRaw = (position && oraclePrice && oraclePrice > 0n && marketBorrowData)
    ? computeMaxBorrow(
        position.collateral,
        oraclePrice,
        marketLltv,
        position.borrowShares,
        marketBorrowData.totalAssets,
        marketBorrowData.totalShares,
      )
    : null;
  const maxBorrowAmount = maxBorrowRaw !== null
    ? Math.max(0, parseFloat(formatTokenAmount(maxBorrowRaw * BORROW_SAFETY_BUFFER / 1000n, loanDecimals)))
    : null;

  // --- Simulation ---

  const simulation: SimulationResult | null = useMemo(() => {
    if (!position || !oraclePrice || oraclePrice === 0n || !marketBorrowData) return null;

    const parseAmount = (val: string, decimals: number): bigint => {
      if (!val || parseFloat(val) <= 0) return 0n;
      try { return parseTokenAmount(val, decimals); } catch { return 0n; }
    };

    // Only include amounts relevant to the active tab to prevent cross-tab leakage
    const action = activeTab === 'borrow'
      ? {
          addCollateral: parseAmount(collateralAmount, collateralDecimals),
          addBorrow: parseAmount(borrowAmount, loanDecimals),
          repayAssets: 0n,
          withdrawCollateral: 0n,
        }
      : {
          addCollateral: 0n,
          addBorrow: 0n,
          repayAssets: parseAmount(repayAmount, loanDecimals),
          withdrawCollateral: parseAmount(withdrawAmount, collateralDecimals),
        };

    return simulatePosition({
      position: { collateral: position.collateral, borrowShares: position.borrowShares },
      marketState: {
        totalBorrowAssets: marketBorrowData.totalAssets,
        totalBorrowShares: marketBorrowData.totalShares,
        oraclePrice,
        lltv: marketLltv,
      },
      action,
      loanDecimals,
      collateralDecimals,
    });
  }, [position, oraclePrice, marketBorrowData, marketLltv, collateralAmount, borrowAmount, repayAmount, withdrawAmount, loanDecimals, collateralDecimals, activeTab]);

  // --- Validation ---

  const borrowValidation: ValidationResult = useMemo(() => {
    return validateBorrowAction({
      collateralAmount,
      borrowAmount,
      collateralDecimals,
      loanDecimals,
      collateralBalance,
      position: position ? { collateral: position.collateral, borrowShares: position.borrowShares } : null,
      oraclePrice,
      marketLltv,
      marketBorrowData,
      marketLiquidity: null, // Could be enhanced with GraphQL liquidity data
      isConnected,
      loanSymbol,
      collateralSymbol,
    });
  }, [collateralAmount, borrowAmount, collateralDecimals, loanDecimals, collateralBalance, position, oraclePrice, marketLltv, marketBorrowData, isConnected, loanSymbol, collateralSymbol]);

  const repayValidation: ValidationResult = useMemo(() => {
    return validateRepayAction({
      repayAmount,
      withdrawAmount,
      loanDecimals,
      collateralDecimals,
      loanBalance,
      position: position ? { collateral: position.collateral, borrowShares: position.borrowShares } : null,
      oraclePrice,
      marketLltv,
      marketBorrowData,
      isConnected,
      loanSymbol,
      collateralSymbol,
    });
  }, [repayAmount, withdrawAmount, loanDecimals, collateralDecimals, loanBalance, position, oraclePrice, marketLltv, marketBorrowData, isConnected, loanSymbol, collateralSymbol]);

  // --- Dynamic CTA ---

  const borrowCtaLabel = useMemo(() => {
    const hasCollateral = collateralAmount && parseFloat(collateralAmount) > 0;
    const hasBorrow = borrowAmount && parseFloat(borrowAmount) > 0;
    if (hasCollateral && hasBorrow) return `Supply & Borrow`;
    if (hasCollateral) return `Supply Collateral`;
    if (hasBorrow) return `Borrow ${loanSymbol}`;
    return 'Enter amounts';
  }, [collateralAmount, borrowAmount, loanSymbol]);

  const repayCtaLabel = useMemo(() => {
    const hasRepay = repayAmount && parseFloat(repayAmount) > 0;
    const hasWithdraw = withdrawAmount && parseFloat(withdrawAmount) > 0;
    if (hasRepay && hasWithdraw) return `Repay & Withdraw`;
    if (hasRepay) return `Repay ${loanSymbol}`;
    if (hasWithdraw) return `Withdraw ${collateralSymbol}`;
    return 'Enter amounts';
  }, [repayAmount, withdrawAmount, loanSymbol, collateralSymbol]);

  // --- Dynamic tx steps ---

  const borrowTxSteps: TxStep[] = useMemo(() => {
    const steps: TxStep[] = [];
    const hasCollateral = collateralAmount && parseFloat(collateralAmount) > 0;
    const hasBorrow = borrowAmount && parseFloat(borrowAmount) > 0;
    const collateralParsed = hasCollateral ? (() => { try { return parseTokenAmount(collateralAmount, collateralDecimals); } catch { return 0n; } })() : 0n;

    if (hasCollateral) {
      const needsApprove = collateralAllowance === null || collateralParsed > collateralAllowance;
      if (needsApprove) {
        steps.push({ label: 'Approve', description: `Approve ${collateralSymbol} to Morpho` });
      }
      steps.push({ label: 'Supply', description: `Supply ${collateralAmount} ${collateralSymbol} collateral` });
    }
    if (hasBorrow) {
      steps.push({ label: 'Borrow', description: `Borrow ${borrowAmount} ${loanSymbol}` });
    }
    return steps;
  }, [collateralAmount, borrowAmount, collateralDecimals, collateralAllowance, collateralSymbol, loanSymbol]);

  const repayTxSteps: TxStep[] = useMemo(() => {
    const steps: TxStep[] = [];
    const hasRepay = repayAmount && parseFloat(repayAmount) > 0;
    const hasWithdraw = withdrawAmount && parseFloat(withdrawAmount) > 0;

    if (hasRepay) {
      const repayParsed = (() => { try { return parseTokenAmount(repayAmount, loanDecimals); } catch { return 0n; } })();
      const needsApprove = loanAllowance === null || repayParsed > loanAllowance;
      if (needsApprove) {
        steps.push({ label: 'Approve', description: `Approve ${loanSymbol} to Morpho` });
      }
      steps.push({ label: 'Repay', description: `Repay ${repayAmount} ${loanSymbol}` });
    }
    if (hasWithdraw) {
      steps.push({ label: 'Withdraw', description: `Withdraw ${withdrawAmount} ${collateralSymbol}` });
    }
    return steps;
  }, [repayAmount, withdrawAmount, loanDecimals, loanAllowance, loanSymbol, collateralSymbol]);

  // --- Reset state on market/chain change ---

  const repayDefaultSet = useRef(false);
  const withdrawDefaultSet = useRef(false);
  useEffect(() => {
    setPosition(null);
    setCollateralBalance(null);
    setLoanBalance(null);
    setHealthFactor(null);
    setLiquidationPrice(null);
    setOraclePrice(null);
    setMarketBorrowData(null);
    setCollateralAllowance(null);
    setLoanAllowance(null);
    setCollateralAmount('');
    setBorrowAmount('');
    setRepayAmount('');
    setWithdrawAmount('');
    resetTxState();
    repayDefaultSet.current = false;
    withdrawDefaultSet.current = false;
  }, [selectedMarketKey, selectedChain.id, resetTxState]);

  // Set defaults once when data first loads
  useEffect(() => {
    if (!repayDefaultSet.current && maxRepayAmount !== null && maxRepayAmount > 0) {
      setRepayAmount(Math.min(1, maxRepayAmount).toString());
      repayDefaultSet.current = true;
    }
  }, [maxRepayAmount]);
  useEffect(() => {
    if (!withdrawDefaultSet.current && maxWithdrawCollateral !== null && maxWithdrawCollateral > 0) {
      setWithdrawAmount(Math.min(0.05, maxWithdrawCollateral).toString());
      withdrawDefaultSet.current = true;
    }
  }, [maxWithdrawCollateral]);

  // --- Data fetching ---

  const fetchBalances = useCallback(async (silent = false) => {
    if (!address || !loanToken || !collateralToken) return;
    if (!silent) setStatus('Fetching balances...', 'processing');

    try {
      const results = await withRetry(() =>
        publicClient.multicall({
          contracts: [
            { address: collateralToken, abi: ERC20_ABI, functionName: 'balanceOf', args: [address as `0x${string}`] },
            { address: loanToken, abi: ERC20_ABI, functionName: 'balanceOf', args: [address as `0x${string}`] },
            { address: collateralToken, abi: ERC20_ABI, functionName: 'allowance', args: [address as `0x${string}`, MORPHO_CORE_ADDRESS] },
            { address: loanToken, abi: ERC20_ABI, functionName: 'allowance', args: [address as `0x${string}`, MORPHO_CORE_ADDRESS] },
          ],
        })
      );

      const [collBalResult, loanBalResult, collAllowResult, loanAllowResult] = results;
      if (collBalResult.status === 'success') setCollateralBalance(collBalResult.result as bigint);
      if (loanBalResult.status === 'success') setLoanBalance(loanBalResult.result as bigint);
      if (collAllowResult.status === 'success') setCollateralAllowance(collAllowResult.result as bigint);
      if (loanAllowResult.status === 'success') setLoanAllowance(loanAllowResult.result as bigint);

      if (!silent && collBalResult.status === 'success' && loanBalResult.status === 'success') {
        setStatus(`${collateralSymbol}: ${formatTokenAmount(collBalResult.result as bigint, collateralDecimals)}, ${loanSymbol}: ${formatTokenAmount(loanBalResult.result as bigint, loanDecimals)}`, 'info');
      }
    } catch (error) {
      console.error(error);
      if (!silent) setStatus('Failed to fetch balances.', 'error');
    }
  }, [address, loanToken, collateralToken, publicClient, collateralSymbol, loanSymbol, collateralDecimals, loanDecimals, setStatus]);

  const fetchPosition = useCallback(async (silent = false) => {
    if (!address || !marketId || !marketParamsArg || !oracleAddress) return;
    if (!silent) setStatus('Fetching position...', 'processing');

    try {
      const results = await withRetry(() =>
        publicClient.multicall({
          contracts: [
            { address: MORPHO_CORE_ADDRESS, abi: MORPHO_CORE_ABI, functionName: 'position', args: [marketId, address as `0x${string}`] },
            { address: MORPHO_CORE_ADDRESS, abi: MORPHO_CORE_ABI, functionName: 'market', args: [marketId] },
            { address: oracleAddress, abi: MORPHO_ORACLE_ABI, functionName: 'price' },
          ],
        })
      );

      const [positionResult, marketResult, priceResult] = results;

      if (positionResult.status !== 'success' || marketResult.status !== 'success' || priceResult.status !== 'success') {
        throw new Error('One or more multicall results failed');
      }

      const [supplyShares, borrowShares, collateral] = positionResult.result as [bigint, bigint, bigint];
      setPosition({ supplyShares, borrowShares, collateral });

      const price = priceResult.result as bigint;
      setOraclePrice(price);

      const [, , totalBorrowAssets, totalBorrowShares] = marketResult.result as [bigint, bigint, bigint, bigint, bigint, bigint];
      setMarketBorrowData({ totalAssets: totalBorrowAssets, totalShares: totalBorrowShares });

      if (price === 0n || collateral === 0n) {
        setHealthFactor(null);
        setLiquidationPrice(null);
      } else if (borrowShares > 0n) {
        const hf = computeHealthFactor(
          collateral, borrowShares, price, marketLltv,
          totalBorrowAssets, totalBorrowShares,
        );
        setHealthFactor(hf);
        const liqPrice = computeLiquidationPrice(
          collateral, borrowShares, marketLltv,
          totalBorrowAssets, totalBorrowShares,
        );
        setLiquidationPrice(liqPrice);
      } else {
        setHealthFactor(null);
        setLiquidationPrice(null);
      }

      if (!silent) {
        setStatus(
          `Collateral: ${formatTokenAmount(collateral, collateralDecimals)} ${collateralSymbol}, Borrows: ${formatTokenAmount(borrowShares, 18)} shares`,
          'info'
        );
      }
    } catch (error) {
      console.error(error);
      // Preserve existing position data on error — don't zero out
      if (!silent) setStatus('Failed to fetch position. Retrying...', 'error');
    }
  }, [address, marketId, marketParamsArg, oracleAddress, publicClient, marketLltv, collateralDecimals, collateralSymbol, setStatus]);

  // Keep refs current so the effect doesn't re-fire on callback identity changes
  const fetchBalancesRef = useRef(fetchBalances);
  const fetchPositionRef = useRef(fetchPosition);
  useEffect(() => { fetchBalancesRef.current = fetchBalances; }, [fetchBalances]);
  useEffect(() => { fetchPositionRef.current = fetchPosition; }, [fetchPosition]);

  // Auto-fetch on mount, when market changes, and when tokens become available
  useEffect(() => {
    if (address && isReady && selectedMarketKey && loanToken && collateralToken) {
      Promise.all([
        fetchBalancesRef.current(true),
        fetchPositionRef.current(true),
      ]).catch(() => {});
    }
  }, [address, isReady, selectedMarketKey, loanToken, collateralToken]);

  // --- Transaction handlers (internal) ---

  const getSdkMarket = useCallback(() => {
    if (!walletClient) throw new Error('Wallet not connected');
    if (!marketParamsArg) throw new Error('Market parameters are missing.');
    if (selectedChain.id !== base.id) throw new Error('Morpho SDK actions are enabled on Base only.');

    const userAddress = getWalletClientAddress(walletClient);
    const marketParams = new MarketParams(marketParamsArg);

    return {
      userAddress,
      sdkMarket: createMorphoClient(walletClient).marketV1(marketParams, base.id),
    };
  }, [marketParamsArg, selectedChain.id, walletClient]);

  const sendSdkAction = useCallback(async (
    buildTx: (requirementSignature?: RequirementSignature) => Readonly<Transaction>,
    getRequirements?: () => Promise<readonly MorphoRequirement[]>,
  ) => {
    if (!walletClient) throw new Error('Wallet not connected');
    const userAddress = getWalletClientAddress(walletClient);
    const requirementSignature = getRequirements
      ? await resolveRequirements(await getRequirements(), walletClient, publicClient, userAddress, selectedChain)
      : undefined;
    return sendBuiltTx(walletClient, buildTx(requirementSignature), selectedChain);
  }, [publicClient, selectedChain, walletClient]);

  const handleSupplyAndBorrow = async () => {
    if (!address || !marketParamsArg || !collateralToken) return;

    const collErr = validateAmount(collateralAmount, collateralDecimals, collateralBalance ?? undefined);
    if (collErr) { setStatus(`Collateral: ${collErr}`, 'error'); return; }
    const borrowErr = validateAmount(borrowAmount, loanDecimals);
    if (borrowErr) { setStatus(`Borrow: ${borrowErr}`, 'error'); return; }

    if (oraclePrice && oraclePrice > 0n && marketBorrowData) {
      const existingCollateral = position?.collateral ?? 0n;
      const newCollateral = parseTokenAmount(collateralAmount, collateralDecimals);
      const effectiveCollateral = existingCollateral + newCollateral;
      const maxBorrowWithBuffer = computeMaxBorrow(
        effectiveCollateral, oraclePrice, marketLltv,
        position?.borrowShares ?? 0n, marketBorrowData.totalAssets, marketBorrowData.totalShares,
      ) * BORROW_SAFETY_BUFFER / 1000n;
      const requestedBorrow = parseTokenAmount(borrowAmount, loanDecimals);
      if (requestedBorrow > maxBorrowWithBuffer) {
        const maxFormatted = formatTokenAmount(maxBorrowWithBuffer, loanDecimals);
        setStatus(`Borrow amount exceeds safe limit. Max ~${maxFormatted} ${loanSymbol} with this collateral.`, 'error');
        return;
      }
    }

    await executeTx(
      { start: 'Supply & Borrow (approve + supply + borrow)...', error: 'Supply & Borrow failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const collAmount = parseTokenAmount(collateralAmount, collateralDecimals);
        const borrAmount = parseTokenAmount(borrowAmount, loanDecimals);
        const { userAddress, sdkMarket } = getSdkMarket();
        const positionData = await sdkMarket.getPositionData(userAddress);
        const action = sdkMarket.supplyCollateralBorrow({
          amount: collAmount,
          borrowAmount: borrAmount,
          userAddress,
          positionData,
        });
        const hash = await sendSdkAction(action.buildTx, action.getRequirements);
        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus('Supply & Borrow successful!');
        await Promise.all([fetchBalances(true), fetchPosition(true)]);
      },
    );
  };

  const handleSupplyOnly = async () => {
    if (!address || !marketParamsArg || !collateralToken) return;

    const validationError = validateAmount(collateralAmount, collateralDecimals, collateralBalance ?? undefined);
    if (validationError) { setStatus(validationError, 'error'); return; }

    await executeTx(
      { start: 'Supplying collateral (approve + supply)...', error: 'Collateral supply failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const amount = parseTokenAmount(collateralAmount, collateralDecimals);
        const { userAddress, sdkMarket } = getSdkMarket();
        const action = sdkMarket.supplyCollateral({ amount, userAddress });
        const hash = await sendSdkAction(action.buildTx, action.getRequirements);
        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus(`${collateralSymbol} collateral supplied successfully!`);
        await Promise.all([fetchBalances(true), fetchPosition(true)]);
      },
    );
  };

  const handleBorrowOnly = async () => {
    if (!address || !marketParamsArg) return;

    const validationError = validateAmount(borrowAmount, loanDecimals);
    if (validationError) { setStatus(validationError, 'error'); return; }

    if (maxBorrowRaw !== null) {
      const requestedBorrow = parseTokenAmount(borrowAmount, loanDecimals);
      const safeMax = maxBorrowRaw * BORROW_SAFETY_BUFFER / 1000n;
      if (requestedBorrow > safeMax) {
        const maxFormatted = formatTokenAmount(safeMax, loanDecimals);
        setStatus(`Borrow limit: max ~${maxFormatted} ${loanSymbol} with existing collateral.`, 'error');
        return;
      }
    }

    await executeTx(
      { start: `Borrowing ${loanSymbol}...`, error: 'Borrow failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const amount = parseTokenAmount(borrowAmount, loanDecimals);
        const { userAddress, sdkMarket } = getSdkMarket();
        const positionData = await sdkMarket.getPositionData(userAddress);
        const action = sdkMarket.borrow({ amount, userAddress, positionData });
        const hash = await sendSdkAction(action.buildTx, action.getRequirements);
        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus(`${loanSymbol} borrowed successfully!`);
        await Promise.all([fetchBalances(true), fetchPosition(true)]);
      },
    );
  };

  // Single execute for borrow tab — dispatches based on inputs
  const handleBorrowExecute = async () => {
    const hasCollateral = collateralAmount && parseFloat(collateralAmount) > 0;
    const hasBorrow = borrowAmount && parseFloat(borrowAmount) > 0;

    if (hasCollateral && hasBorrow) {
      await handleSupplyAndBorrow();
    } else if (hasCollateral) {
      await handleSupplyOnly();
    } else if (hasBorrow) {
      await handleBorrowOnly();
    }
  };

  const handleRepay = async () => {
    if (!address || !marketParamsArg || !loanToken) return;

    const validationError = validateAmount(repayAmount, loanDecimals, loanBalance ?? undefined);
    if (validationError) { setStatus(validationError, 'error'); return; }

    await executeTx(
      { start: 'Repaying (approve + repay)...', error: 'Repay failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const amount = parseTokenAmount(repayAmount, loanDecimals);
        const { userAddress, sdkMarket } = getSdkMarket();
        const positionData = await sdkMarket.getPositionData(userAddress);
        const repayAmountArgs = amount >= positionData.borrowAssets
          ? { shares: positionData.borrowShares }
          : { assets: amount };
        if ('shares' in repayAmountArgs && repayAmountArgs.shares === 0n) {
          setStatus('No debt to repay.');
          return;
        }
        const action = sdkMarket.repay({ ...repayAmountArgs, userAddress, positionData });
        const hash = await sendSdkAction(action.buildTx, action.getRequirements);
        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus(`${loanSymbol} repaid successfully!`);
        await Promise.all([fetchBalances(true), fetchPosition(true)]);
      },
    );
  };

  const handleRepayAll = async () => {
    if (!address || !marketParamsArg || !loanToken) return;

    await executeTx(
      { start: 'Repaying all debt (shares-based)...', error: 'Repay All failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const { userAddress, sdkMarket } = getSdkMarket();
        const positionData = await sdkMarket.getPositionData(userAddress);
        if (positionData.borrowShares === 0n) {
          setStatus('No debt to repay.');
          return;
        }

        const action = sdkMarket.repay({
          shares: positionData.borrowShares,
          userAddress,
          positionData,
        });
        const hash = await sendSdkAction(action.buildTx, action.getRequirements);
        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus('All debt repaid successfully!');
        await Promise.all([fetchBalances(true), fetchPosition(true)]);
      },
    );
  };

  const handleWithdrawCollateral = async () => {
    if (!address || !marketParamsArg) return;

    const validationError = validateAmount(withdrawAmount, collateralDecimals);
    if (validationError) { setStatus(validationError, 'error'); return; }

    await executeTx(
      { start: `Withdrawing ${collateralSymbol} collateral...`, error: 'Collateral withdrawal failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const amount = parseTokenAmount(withdrawAmount, collateralDecimals);
        const { userAddress, sdkMarket } = getSdkMarket();
        const positionData = await sdkMarket.getPositionData(userAddress);
        const tx = sdkMarket.withdrawCollateral({ amount, userAddress, positionData }).buildTx();
        const hash = await sendSdkAction(() => tx);
        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus(`${withdrawAmount} ${collateralSymbol} collateral withdrawn successfully!`);
        await Promise.all([fetchBalances(true), fetchPosition(true)]);
      },
    );
  };

  const handleWithdrawAllCollateral = async () => {
    if (!address || !position || isZero(position.collateral) || !marketParamsArg) return;

    await executeTx(
      { start: `Withdrawing all ${collateralSymbol} collateral...`, error: 'Collateral withdrawal failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const { userAddress, sdkMarket } = getSdkMarket();
        const positionData = await sdkMarket.getPositionData(userAddress);
        const tx = sdkMarket.withdrawCollateral({
          amount: positionData.collateral,
          userAddress,
          positionData,
        }).buildTx();
        const hash = await sendSdkAction(() => tx);
        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus(`All ${collateralSymbol} collateral withdrawn successfully!`);
        setPosition(null);
        setHealthFactor(null);
        setLiquidationPrice(null);
        await fetchBalances(true);
      },
    );
  };

  const handleRepayAndWithdrawCollateral = async () => {
    if (!address || !marketParamsArg || !loanToken) return;

    const repayValidationError = validateAmount(repayAmount, loanDecimals, loanBalance ?? undefined);
    if (repayValidationError) { setStatus(repayValidationError, 'error'); return; }

    const withdrawValidationError = validateAmount(withdrawAmount, collateralDecimals);
    if (withdrawValidationError) { setStatus(withdrawValidationError, 'error'); return; }

    await executeTx(
      { start: 'Repaying and withdrawing collateral...', error: 'Repay & Withdraw failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const repayAssets = parseTokenAmount(repayAmount, loanDecimals);
        const withdrawParsed = parseTokenAmount(withdrawAmount, collateralDecimals);
        const { userAddress, sdkMarket } = getSdkMarket();
        const positionData = await sdkMarket.getPositionData(userAddress);
        const repayAmountArgs = repayAssets >= positionData.borrowAssets
          ? { shares: positionData.borrowShares }
          : { assets: repayAssets };
        if ('shares' in repayAmountArgs && repayAmountArgs.shares === 0n) {
          setStatus('No debt to repay.');
          return;
        }

        const action = sdkMarket.repayWithdrawCollateral({
          ...repayAmountArgs,
          withdrawAmount: withdrawParsed,
          userAddress,
          positionData,
        });
        const hash = await sendSdkAction(action.buildTx, action.getRequirements);
        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus('Repay & Withdraw successful!');
        await Promise.all([fetchBalances(true), fetchPosition(true)]);
      },
    );
  };

  // Single execute for repay tab — dispatches based on inputs
  const handleRepayExecute = async () => {
    const hasRepay = repayAmount && parseFloat(repayAmount) > 0;
    const hasWithdraw = withdrawAmount && parseFloat(withdrawAmount) > 0;

    if (hasRepay && hasWithdraw) {
      await handleRepayAndWithdrawCollateral();
    } else if (hasRepay) {
      await handleRepay();
    } else if (hasWithdraw) {
      await handleWithdrawCollateral();
    }
  };

  return {
    // Inputs
    collateralAmount, setCollateralAmount,
    borrowAmount, setBorrowAmount,
    repayAmount, setRepayAmount,
    withdrawAmount, setWithdrawAmount,

    // Status
    status, statusKind, txHash, isLoading, explorerUrl,

    // Position data
    collateralBalance, loanBalance, position,
    healthFactor, liquidationPrice,
    oraclePrice, marketBorrowData,
    currentDebtAssets,

    // Computed limits
    maxRepayAmount, maxBorrowAmount, maxWithdrawCollateral,

    // Simulation & validation
    simulation,
    borrowValidation, repayValidation,
    borrowCtaLabel, repayCtaLabel,
    borrowTxSteps, repayTxSteps,

    // Actions
    fetchBalances, fetchPosition,
    handleBorrowExecute,
    handleRepayExecute,
    handleRepayAll,
    handleWithdrawAllCollateral,
  };
}
