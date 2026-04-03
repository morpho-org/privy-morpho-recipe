import { formatUnits, parseUnits } from 'viem';
import { VAULT_SHARES_DECIMALS } from './constants';

export function formatTokenAmount(amount: bigint, decimals: number): string {
  return formatUnits(amount, decimals);
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}

export function formatVaultShares(shares: bigint): string {
  return formatUnits(shares, VAULT_SHARES_DECIMALS);
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getExplorerTxUrl(explorerUrl: string, txHash: string): string {
  return `${explorerUrl}/tx/${txHash}`;
}

export function isZero(amount: bigint | null): boolean {
  return amount === null || amount === BigInt(0);
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null) return '-';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '-';
  return `${(value * 100).toFixed(2)}%`;
}

/** Returns an error message if invalid, or null if valid. */
export function validateAmount(
  input: string,
  decimals: number,
  maxBalance?: bigint,
): string | null {
  if (!input || input.trim() === '') return 'Please enter an amount.';

  const num = Number(input);
  if (isNaN(num)) return 'Please enter a valid number.';
  if (num <= 0) return 'Amount must be greater than zero.';

  const parts = input.split('.');
  if (parts[1] && parts[1].length > decimals) {
    return `Too many decimal places (max ${decimals}).`;
  }

  if (maxBalance !== undefined) {
    try {
      const parsed = parseUnits(input, decimals);
      if (parsed > maxBalance) return 'Amount exceeds your balance.';
    } catch {
      return 'Please enter a valid number.';
    }
  }

  return null;
}
