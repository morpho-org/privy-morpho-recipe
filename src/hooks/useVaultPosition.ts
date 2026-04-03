'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { encodeFunctionData } from 'viem';

import {
  ERC20_ABI,
  MORPHO_VAULT_ABI,
} from '@/lib/constants';

import {
  parseTokenAmount,
  formatVaultShares,
  isZero,
  validateAmount,
} from '@/lib/utils';

import { useSmartAccount } from '@/hooks/useSmartAccount';
import { usePublicClient } from '@/hooks/usePublicClient';
import { useTxLifecycle } from '@/hooks/useTxLifecycle';
import { useChain } from '@/context/ChainContext';

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;

function formatPositionUsd(sharesAmount: bigint, sharePriceUsd: number | null): string | null {
  if (!sharePriceUsd) return null;
  const sharesFloat = parseFloat(formatVaultShares(sharesAmount));
  return (sharesFloat * sharePriceUsd).toFixed(2);
}
const VAULT_SAFETY_THRESHOLD = 10n ** 9n;
const LARGE_SLIPPAGE_BPS = 500n; // 5% — only warn if discrepancy exceeds this

interface VaultInfo {
  selectedVaultAddress: string;
  assetDecimals: number;
  assetSymbol: string;
  assetAddress: `0x${string}` | undefined;
  assetPriceUsd: number | null;
  sharePriceUsd: number | null;
}

export function useVaultPosition(vault: VaultInfo) {
  const { sendBatchTransaction, sendSingleTransaction, address } = useSmartAccount();
  const publicClient = usePublicClient();
  const { selectedChain } = useChain();

  const {
    selectedVaultAddress,
    assetDecimals,
    assetSymbol,
    assetAddress,
    assetPriceUsd,
    sharePriceUsd,
  } = vault;

  const explorerUrl = selectedChain.blockExplorers?.default?.url ?? '';

  const { status, statusKind, setStatus, txHash, isLoading, executeTx, resetTxState } = useTxLifecycle();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [shares, setShares] = useState<bigint | null>(null);
  const [assetBalance, setAssetBalance] = useState<bigint | null>(null);
  const [vaultSafetyWarning, setVaultSafetyWarning] = useState<string | null>(null);

  const maxWithdrawUsd = (shares !== null && shares > 0n && sharePriceUsd)
    ? parseFloat(formatVaultShares(shares)) * sharePriceUsd
    : null;

  // Reset state when vault or chain changes
  const withdrawDefaultSet = useRef(false);
  useEffect(() => {
    setShares(null);
    setAssetBalance(null);
    setWithdrawAmount('');
    resetTxState();
    setVaultSafetyWarning(null);
    withdrawDefaultSet.current = false;
  }, [selectedVaultAddress, selectedChain.id, resetTxState]);

  // Set default withdraw amount once when position data first loads
  useEffect(() => {
    if (!withdrawDefaultSet.current && maxWithdrawUsd !== null && maxWithdrawUsd > 0) {
      setWithdrawAmount(Math.min(1, maxWithdrawUsd).toFixed(2));
      withdrawDefaultSet.current = true;
    }
  }, [maxWithdrawUsd]);

  const checkVaultSafety = useCallback(async () => {
    if (!selectedVaultAddress) return;

    try {
      const deadShares = await publicClient.readContract({
        address: selectedVaultAddress as `0x${string}`,
        abi: MORPHO_VAULT_ABI,
        functionName: 'balanceOf',
        args: [DEAD_ADDRESS],
      });

      if ((deadShares as bigint) < VAULT_SAFETY_THRESHOLD) {
        setVaultSafetyWarning(
          'This vault has insufficient dead deposit (shares at 0x...dEaD < 1e9). It may be vulnerable to an ERC4626 inflation attack. Proceed with caution.'
        );
      } else {
        setVaultSafetyWarning(null);
      }
    } catch (err) {
      console.error('Vault safety check failed:', err);
      setVaultSafetyWarning(null);
    }
  }, [selectedVaultAddress, publicClient]);

  const fetchAssetBalance = useCallback(async () => {
    if (!address || !assetAddress) return;
    try {
      const balance = await publicClient.readContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });
      setAssetBalance(balance);
    } catch (error) {
      console.error('Failed to fetch asset balance:', error);
    }
  }, [address, assetAddress, publicClient]);

  const fetchShares = useCallback(async () => {
    if (!address || !selectedVaultAddress) return;
    try {
      const balance = await publicClient.readContract({
        address: selectedVaultAddress as `0x${string}`,
        abi: MORPHO_VAULT_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });
      setShares(balance as bigint);
    } catch (error) {
      console.error('Failed to fetch vault shares:', error);
    }
  }, [address, selectedVaultAddress, publicClient]);

  // Keep refs current so the effect doesn't re-fire on callback identity changes
  const fetchAssetBalanceRef = useRef(fetchAssetBalance);
  const fetchSharesRef = useRef(fetchShares);
  const checkVaultSafetyRef = useRef(checkVaultSafety);
  useEffect(() => { fetchAssetBalanceRef.current = fetchAssetBalance; }, [fetchAssetBalance]);
  useEffect(() => { fetchSharesRef.current = fetchShares; }, [fetchShares]);
  useEffect(() => { checkVaultSafetyRef.current = checkVaultSafety; }, [checkVaultSafety]);

  useEffect(() => {
    if (address && selectedVaultAddress && assetAddress) {
      Promise.all([
        fetchAssetBalanceRef.current(),
        fetchSharesRef.current(),
        checkVaultSafetyRef.current(),
      ]).catch(() => {});
    }
  }, [address, selectedVaultAddress, assetAddress]);

  const handleDeposit = async () => {
    if (!selectedVaultAddress || !address || !assetAddress) return;

    const validationError = validateAmount(depositAmount, assetDecimals, assetBalance ?? undefined);
    if (validationError) {
      setStatus(validationError, 'error');
      return;
    }

    await executeTx(
      { start: 'Depositing (approve + deposit)...', error: 'Deposit failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const amount = parseTokenAmount(depositAmount, assetDecimals);
        const vaultAddr = selectedVaultAddress as `0x${string}`;

        const expectedShares = await publicClient.readContract({
          address: vaultAddr,
          abi: MORPHO_VAULT_ABI,
          functionName: 'previewDeposit',
          args: [amount],
        }) as bigint;

        const approveCalldata = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [vaultAddr, amount],
        });

        const depositCalldata = encodeFunctionData({
          abi: MORPHO_VAULT_ABI,
          functionName: 'deposit',
          args: [amount, address as `0x${string}`],
        });

        const sharesBefore = shares ?? 0n;

        const { hash } = await sendBatchTransaction([
          { to: assetAddress, data: approveCalldata },
          { to: vaultAddr, data: depositCalldata },
        ]);

        setTxHash(hash);

        const [newBalance] = await Promise.all([
          publicClient.readContract({
            address: vaultAddr,
            abi: MORPHO_VAULT_ABI,
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
          }) as Promise<bigint>,
          fetchAssetBalance(),
        ]);

        const sharesMinted = newBalance - sharesBefore;
        const slippageThreshold = expectedShares * (10000n - LARGE_SLIPPAGE_BPS) / 10000n;

        const positionUsd = formatPositionUsd(newBalance, sharePriceUsd);
        const positionSuffix = positionUsd ? ` Your position is now $${positionUsd}.` : '';

        if (expectedShares > 0n && sharesMinted < slippageThreshold) {
          setStatus(`Deposit successful! Deposited ${depositAmount} ${assetSymbol}.${positionSuffix} Note: received slightly fewer shares than estimated.`);
        } else {
          setStatus(`Deposit successful! Deposited ${depositAmount} ${assetSymbol}.${positionSuffix}`);
        }

        setShares(newBalance);
        setDepositAmount('');
      },
    );
  };

  const handleWithdrawAll = async () => {
    if (!selectedVaultAddress || !address || isZero(shares)) return;

    await executeTx(
      { start: 'Withdrawing all...', error: 'Full withdrawal failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const vaultAddr = selectedVaultAddress as `0x${string}`;

        const redeemCalldata = encodeFunctionData({
          abi: MORPHO_VAULT_ABI,
          functionName: 'redeem',
          args: [shares!, address as `0x${string}`, address as `0x${string}`],
        });

        const hash = await sendSingleTransaction({
          to: vaultAddr,
          data: redeemCalldata,
        });

        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
        setStatus('Withdrawal successful! All shares redeemed.');
        setShares(0n);
        setWithdrawAmount('');
        await fetchAssetBalance();
      },
    );
  };

  const handleWithdrawAmount = async () => {
    if (!selectedVaultAddress || !address || !assetPriceUsd) return;

    const usdAmount = parseFloat(withdrawAmount);
    if (isNaN(usdAmount) || usdAmount <= 0) {
      setStatus('Please enter a valid positive amount.', 'error');
      return;
    }

    if (maxWithdrawUsd !== null && usdAmount > maxWithdrawUsd) {
      setStatus(`Amount exceeds your position ($${maxWithdrawUsd.toFixed(2)} available).`, 'error');
      return;
    }

    await executeTx(
      { start: 'Withdrawing amount...', error: 'Partial withdrawal failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        const vaultAddr = selectedVaultAddress as `0x${string}`;
        const tokenAmount = usdAmount / assetPriceUsd;
        const amount = parseTokenAmount(tokenAmount.toString(), assetDecimals);

        setStatus(`Withdrawing ~${tokenAmount.toFixed(2)} ${assetSymbol}...`);

        const withdrawCalldata = encodeFunctionData({
          abi: MORPHO_VAULT_ABI,
          functionName: 'withdraw',
          args: [amount, address as `0x${string}`, address as `0x${string}`],
        });

        const hash = await sendSingleTransaction({
          to: vaultAddr,
          data: withdrawCalldata,
        });

        setTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

        // Read new balance directly from contract (state updates are async)
        const newShareBalance = await publicClient.readContract({
          address: vaultAddr,
          abi: MORPHO_VAULT_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }) as bigint;

        setShares(newShareBalance);
        await fetchAssetBalance();

        const positionUsd = formatPositionUsd(newShareBalance, sharePriceUsd);
        const positionSuffix = positionUsd ? ` Your position is now $${positionUsd}.` : '';
        setStatus(`Withdrawal of $${withdrawAmount} successful!${positionSuffix}`);
        setWithdrawAmount('');
      },
    );
  };

  return {
    depositAmount,
    setDepositAmount,
    withdrawAmount,
    setWithdrawAmount,
    status,
    statusKind,
    txHash,
    shares,
    assetBalance,
    isLoading,
    vaultSafetyWarning,
    maxWithdrawUsd,
    explorerUrl,
    handleDeposit,
    handleWithdrawAll,
    handleWithdrawAmount,
  };
}
