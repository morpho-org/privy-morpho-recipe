import { describe, it, expect } from 'vitest';
import {
  formatTokenAmount,
  parseTokenAmount,
  formatVaultShares,
  formatAddress,
  getExplorerTxUrl,
  isZero,
  formatUsd,
  formatPercent,
  validateAmount,
} from '@/lib/utils';

describe('formatTokenAmount', () => {
  it('formats USDC (6 decimals)', () => {
    expect(formatTokenAmount(1_000_000n, 6)).toBe('1');
  });

  it('formats WETH (18 decimals)', () => {
    expect(formatTokenAmount(10n ** 18n, 18)).toBe('1');
  });

  it('formats zero', () => {
    expect(formatTokenAmount(0n, 6)).toBe('0');
  });

  it('formats fractional USDC', () => {
    expect(formatTokenAmount(500_000n, 6)).toBe('0.5');
  });

  it('formats small amount', () => {
    expect(formatTokenAmount(1n, 6)).toBe('0.000001');
  });
});

describe('parseTokenAmount', () => {
  it('parses USDC (6 decimals)', () => {
    expect(parseTokenAmount('1', 6)).toBe(1_000_000n);
  });

  it('parses WETH (18 decimals)', () => {
    expect(parseTokenAmount('1', 18)).toBe(10n ** 18n);
  });

  it('parses fractional amount', () => {
    expect(parseTokenAmount('0.5', 6)).toBe(500_000n);
  });

  it('parses zero', () => {
    expect(parseTokenAmount('0', 6)).toBe(0n);
  });
});

describe('formatVaultShares', () => {
  it('formats 1e18 shares as 1', () => {
    expect(formatVaultShares(10n ** 18n)).toBe('1');
  });

  it('formats zero shares', () => {
    expect(formatVaultShares(0n)).toBe('0');
  });

  it('formats fractional shares', () => {
    expect(formatVaultShares(5n * 10n ** 17n)).toBe('0.5');
  });
});

describe('formatAddress', () => {
  it('truncates to 0x1234...abcd format', () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    expect(formatAddress(addr)).toBe('0x1234...5678');
  });

  it('handles different address', () => {
    const addr = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
    expect(formatAddress(addr)).toBe('0xABCD...EF12');
  });
});

describe('getExplorerTxUrl', () => {
  it('constructs basescan URL', () => {
    const url = getExplorerTxUrl('https://basescan.org', '0xabc123');
    expect(url).toBe('https://basescan.org/tx/0xabc123');
  });

  it('constructs etherscan URL', () => {
    const url = getExplorerTxUrl('https://etherscan.io', '0xdef');
    expect(url).toBe('https://etherscan.io/tx/0xdef');
  });
});

describe('isZero', () => {
  it('returns true for null', () => {
    expect(isZero(null)).toBe(true);
  });

  it('returns true for 0n', () => {
    expect(isZero(0n)).toBe(true);
  });

  it('returns false for non-zero', () => {
    expect(isZero(1n)).toBe(false);
  });

  it('returns false for large value', () => {
    expect(isZero(10n ** 18n)).toBe(false);
  });
});

describe('formatUsd', () => {
  it('returns dash for null', () => {
    expect(formatUsd(null)).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(formatUsd(undefined)).toBe('-');
  });

  it('formats billions', () => {
    expect(formatUsd(1_500_000_000)).toBe('$1.5B');
  });

  it('formats millions', () => {
    expect(formatUsd(50_000_000)).toBe('$50.0M');
  });

  it('formats thousands', () => {
    expect(formatUsd(5_000)).toBe('$5.0K');
  });

  it('formats small values', () => {
    expect(formatUsd(42)).toBe('$42');
  });

  it('formats exactly 1B boundary', () => {
    expect(formatUsd(1_000_000_000)).toBe('$1.0B');
  });

  it('formats exactly 1M boundary', () => {
    expect(formatUsd(1_000_000)).toBe('$1.0M');
  });

  it('formats exactly 1K boundary', () => {
    expect(formatUsd(1_000)).toBe('$1.0K');
  });
});

describe('formatPercent', () => {
  it('returns dash for null', () => {
    expect(formatPercent(null)).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(formatPercent(undefined)).toBe('-');
  });

  it('formats 4.85%', () => {
    expect(formatPercent(0.0485)).toBe('4.85%');
  });

  it('formats 0%', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('formats 100%', () => {
    expect(formatPercent(1)).toBe('100.00%');
  });
});

describe('validateAmount', () => {
  it('returns error for empty string', () => {
    expect(validateAmount('', 6)).toBe('Please enter an amount.');
  });

  it('returns error for whitespace', () => {
    expect(validateAmount('   ', 6)).toBe('Please enter an amount.');
  });

  it('returns error for NaN', () => {
    expect(validateAmount('abc', 6)).toBe('Please enter a valid number.');
  });

  it('returns error for zero', () => {
    expect(validateAmount('0', 6)).toBe('Amount must be greater than zero.');
  });

  it('returns error for negative', () => {
    expect(validateAmount('-1', 6)).toBe('Amount must be greater than zero.');
  });

  it('returns error for too many decimals', () => {
    expect(validateAmount('1.1234567', 6)).toBe('Too many decimal places (max 6).');
  });

  it('returns null for valid amount', () => {
    expect(validateAmount('1.5', 6)).toBeNull();
  });

  it('returns error when exceeding balance', () => {
    expect(validateAmount('100', 6, 50_000_000n)).toBe('Amount exceeds your balance.');
  });

  it('returns null when within balance', () => {
    expect(validateAmount('1', 6, 10_000_000n)).toBeNull();
  });

  it('allows exact balance', () => {
    expect(validateAmount('1', 6, 1_000_000n)).toBeNull();
  });
});
