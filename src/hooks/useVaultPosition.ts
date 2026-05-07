'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletClient } from 'wagmi';
import { base } from 'viem/chains';

import {
  ERC20_ABI,
  MORPHO_VAULT_ABI,
} from '@/lib/constants';

import {
  parseTokenAmount,
  formatTokenAmount,
  formatVaultShares,
  isZero,
  validateAmount,
} from '@/lib/utils';

import { useSmartAccount } from '@/hooks/useSmartAccount';
import { usePublicClient } from '@/hooks/usePublicClient';
import { useTxLifecycle } from '@/hooks/useTxLifecycle';
import { useChain } from '@/context/ChainContext';
import { withRetry } from '@/lib/retry';
import {
  createMorphoClient,
  getWalletClientAddress,
  resolveRequirements,
  sendBuiltTx,
} from '@/lib/morphoSdk';

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;

function formatPositionUsd(assetsAmount: bigint, assetDecimals: number, assetPriceUsd: number | null): string | null {
  if (!assetPriceUsd) return null;
  const assetsFloat = parseFloat(formatTokenAmount(assetsAmount, assetDecimals));
  return (assetsFloat * assetPriceUsd).toFixed(2);
}
const VAULT_SAFETY_THRESHOLD = 10n ** 9n;

interface VaultPositionSnapshot {
  shares: bigint;
  assets: bigint;
}

interface VaultInfo {
  selectedVaultAddress: string;
  assetDecimals: number;
  assetSymbol: string;
  assetAddress: `0x${string}` | undefined;
  assetPriceUsd: number | null;
  sharePriceUsd: number | null;
}

export function useVaultPosition(vault: VaultInfo) {
  const { address } = useSmartAccount();
  const { data: walletClient } = useWalletClient();
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
  const [positionAssets, setPositionAssets] = useState<bigint | null>(null);
  const [assetBalance, setAssetBalance] = useState<bigint | null>(null);
  const [vaultSafetyWarning, setVaultSafetyWarning] = useState<string | null>(null);

  const maxWithdrawUsd = (positionAssets !== null && assetPriceUsd)
    ? parseFloat(formatTokenAmount(positionAssets, assetDecimals)) * assetPriceUsd
    : null;

  // Reset state when vault or chain changes
  const withdrawDefaultSet = useRef(false);
  useEffect(() => {
    setShares(null);
    setPositionAssets(null);
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

  const readVaultPositionSnapshot = useCallback(async (
    vaultAddr: `0x${string}`,
    userAddress: `0x${string}`,
    blockNumber?: bigint,
  ): Promise<VaultPositionSnapshot> => {
    const readOptions = blockNumber ? { blockNumber } : {};
    const shareBalance = await publicClient.readContract({
      address: vaultAddr,
      abi: MORPHO_VAULT_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
      ...readOptions,
    }) as bigint;

    if (shareBalance === 0n) {
      return { shares: 0n, assets: 0n };
    }

    const assets = await publicClient.readContract({
      address: vaultAddr,
      abi: MORPHO_VAULT_ABI,
      functionName: 'convertToAssets',
      args: [shareBalance],
      ...readOptions,
    }) as bigint;

    return { shares: shareBalance, assets };
  }, [publicClient]);

  const fetchPositionSnapshot = useCallback(async (
    blockNumber?: bigint,
    isFresh?: (snapshot: VaultPositionSnapshot) => boolean,
  ) => {
    if (!address || !selectedVaultAddress) return null;
    const vaultAddr = selectedVaultAddress as `0x${string}`;
    const userAddress = address as `0x${string}`;

    try {
      const snapshot = await withRetry(async () => {
        const nextSnapshot = await readVaultPositionSnapshot(vaultAddr, userAddress, blockNumber);
        if (isFresh && !isFresh(nextSnapshot)) {
          throw new Error('Vault position snapshot has not caught up to the transaction yet.');
        }
        return nextSnapshot;
      }, 6, 350);

      setShares(snapshot.shares);
      setPositionAssets(snapshot.assets);
      return snapshot;
    } catch (error) {
      console.error('Failed to fetch vault position:', error);
      return null;
    }
  }, [address, selectedVaultAddress, readVaultPositionSnapshot]);

  // Keep refs current so the effect doesn't re-fire on callback identity changes
  const fetchAssetBalanceRef = useRef(fetchAssetBalance);
  const fetchPositionSnapshotRef = useRef(fetchPositionSnapshot);
  const checkVaultSafetyRef = useRef(checkVaultSafety);
  useEffect(() => { fetchAssetBalanceRef.current = fetchAssetBalance; }, [fetchAssetBalance]);
  useEffect(() => { fetchPositionSnapshotRef.current = fetchPositionSnapshot; }, [fetchPositionSnapshot]);
  useEffect(() => { checkVaultSafetyRef.current = checkVaultSafety; }, [checkVaultSafety]);

  useEffect(() => {
    if (address && selectedVaultAddress && assetAddress) {
      Promise.all([
        fetchAssetBalanceRef.current(),
        fetchPositionSnapshotRef.current(),
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
        if (!walletClient) throw new Error('Wallet not connected');
        if (selectedChain.id !== base.id) throw new Error('Morpho SDK actions are enabled on Base only.');

        const amount = parseTokenAmount(depositAmount, assetDecimals);
        const vaultAddr = selectedVaultAddress as `0x${string}`;
        const userAddress = getWalletClientAddress(walletClient);
        const previousShares = shares ?? 0n;
        const morpho = createMorphoClient(walletClient);
        const sdkVault = morpho.vaultV2(vaultAddr, base.id);
        const accrualVault = await sdkVault.getData();
        const deposit = sdkVault.deposit({ amount, userAddress, accrualVault });
        const requirementSignature = await resolveRequirements(
          await deposit.getRequirements(),
          walletClient,
          publicClient,
          userAddress,
          selectedChain,
        );
        const hash = await sendBuiltTx(walletClient, deposit.buildTx(requirementSignature), selectedChain);

        setTxHash(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        const [snapshot] = await Promise.all([
          fetchPositionSnapshot(receipt.blockNumber, (nextSnapshot) => nextSnapshot.shares > previousShares),
          fetchAssetBalance(),
        ]);

        const positionUsd = snapshot
          ? formatPositionUsd(snapshot.assets, assetDecimals, assetPriceUsd)
          : null;
        const positionSuffix = positionUsd ? ` Your position is now $${positionUsd}.` : '';
        setStatus(`Deposit successful! Deposited ${depositAmount} ${assetSymbol}.${positionSuffix}`);

        setDepositAmount('');
      },
    );
  };

  const handleWithdrawAll = async () => {
    if (!selectedVaultAddress || !address || isZero(shares)) return;

    await executeTx(
      { start: 'Withdrawing all...', error: 'Full withdrawal failed. Please try again.' },
      async ({ setTxHash, setStatus }) => {
        if (!walletClient) throw new Error('Wallet not connected');
        if (selectedChain.id !== base.id) throw new Error('Morpho SDK actions are enabled on Base only.');

        const vaultAddr = selectedVaultAddress as `0x${string}`;
        const userAddress = getWalletClientAddress(walletClient);
        const previousShares = shares!;
        const morpho = createMorphoClient(walletClient);
        const tx = morpho.vaultV2(vaultAddr, base.id)
          .redeem({ shares: shares!, userAddress })
          .buildTx();
        const hash = await sendBuiltTx(walletClient, tx, selectedChain);

        setTxHash(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        await Promise.all([
          fetchPositionSnapshot(receipt.blockNumber, (nextSnapshot) => nextSnapshot.shares < previousShares),
          fetchAssetBalance(),
        ]);
        setStatus('Withdrawal successful! All shares redeemed.');
        setWithdrawAmount('');
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
        if (!walletClient) throw new Error('Wallet not connected');
        if (selectedChain.id !== base.id) throw new Error('Morpho SDK actions are enabled on Base only.');

        const vaultAddr = selectedVaultAddress as `0x${string}`;
        const userAddress = getWalletClientAddress(walletClient);
        const previousShares = shares ?? 0n;
        const tokenAmount = usdAmount / assetPriceUsd;
        const amount = parseTokenAmount(tokenAmount.toString(), assetDecimals);

        setStatus(`Withdrawing ~${tokenAmount.toFixed(2)} ${assetSymbol}...`);

        const morpho = createMorphoClient(walletClient);
        const tx = morpho.vaultV2(vaultAddr, base.id)
          .withdraw({ amount, userAddress })
          .buildTx();
        const hash = await sendBuiltTx(walletClient, tx, selectedChain);

        setTxHash(hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        const [snapshot] = await Promise.all([
          fetchPositionSnapshot(receipt.blockNumber, (nextSnapshot) => nextSnapshot.shares < previousShares),
          fetchAssetBalance(),
        ]);

        const positionUsd = snapshot
          ? formatPositionUsd(snapshot.assets, assetDecimals, assetPriceUsd)
          : null;
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
    positionAssets,
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
