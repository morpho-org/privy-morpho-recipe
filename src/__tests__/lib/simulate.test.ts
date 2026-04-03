import { describe, it, expect } from 'vitest';
import { simulatePosition, type SimulationInput } from '@/lib/simulate';
import { WAD, ORACLE_PRICE_SCALE, INFINITE_HEALTH_FACTOR } from '@/lib/constants';

// Helpers for realistic market values
const LLTV_86 = (WAD * 86n) / 100n; // 86% LLTV
const USDC_DECIMALS = 6;
const WETH_DECIMALS = 18;

// Oracle price: 1 WETH = 2000 USDC, scaled to ORACLE_PRICE_SCALE
// price = 2000 * 10^(36 + 6 - 18) = 2000 * 10^24
const ETH_PRICE = 2000n * 10n ** 24n;

function makeInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    position: { collateral: 0n, borrowShares: 0n },
    marketState: {
      totalBorrowAssets: 1000000n * 10n ** 6n, // 1M USDC
      totalBorrowShares: 1000000n * 10n ** 6n, // 1:1 share ratio for simplicity
      oraclePrice: ETH_PRICE,
      lltv: LLTV_86,
    },
    action: { addCollateral: 0n, addBorrow: 0n, repayAssets: 0n, withdrawCollateral: 0n },
    loanDecimals: USDC_DECIMALS,
    collateralDecimals: WETH_DECIMALS,
    ...overrides,
  };
}

describe('simulatePosition', () => {
  it('returns current state with no inputs', () => {
    const result = simulatePosition(makeInput({
      position: { collateral: 1n * 10n ** 18n, borrowShares: 0n },
    }));

    expect(result.hasInput).toBe(false);
    expect(result.projected).toBeNull();
    expect(result.current.collateral).toBe(1n * 10n ** 18n);
    expect(result.current.borrowed).toBe(0n);
    expect(result.current.hf).toBe(INFINITE_HEALTH_FACTOR);
    expect(result.isSafe).toBe(true);
  });

  it('simulates adding collateral only', () => {
    const result = simulatePosition(makeInput({
      action: { addCollateral: 1n * 10n ** 18n, addBorrow: 0n, repayAssets: 0n, withdrawCollateral: 0n },
    }));

    expect(result.hasInput).toBe(true);
    expect(result.projected).not.toBeNull();
    expect(result.projected!.collateral).toBe(1n * 10n ** 18n);
    expect(result.projected!.borrowed).toBe(0n);
    expect(result.isSafe).toBe(true);
  });

  it('simulates borrow with existing collateral', () => {
    const result = simulatePosition(makeInput({
      position: { collateral: 1n * 10n ** 18n, borrowShares: 0n },
      action: { addCollateral: 0n, addBorrow: 1000n * 10n ** 6n, repayAssets: 0n, withdrawCollateral: 0n },
    }));

    expect(result.hasInput).toBe(true);
    expect(result.projected!.borrowed).toBe(1000n * 10n ** 6n);
    // 1 ETH @ 2000 USDC, 86% LLTV → max borrow ~1720 USDC
    // Borrowing 1000 → LTV = 1000/2000 = 50% → safe
    expect(result.isSafe).toBe(true);
    expect(result.exceedsLltv).toBe(false);
    expect(result.projected!.hf > WAD).toBe(true);
  });

  it('detects unsafe borrow exceeding LLTV', () => {
    const result = simulatePosition(makeInput({
      position: { collateral: 1n * 10n ** 18n, borrowShares: 0n },
      // Borrow 1800 USDC against 2000 USDC collateral value → LTV 90% > 86%
      action: { addCollateral: 0n, addBorrow: 1800n * 10n ** 6n, repayAssets: 0n, withdrawCollateral: 0n },
    }));

    expect(result.hasInput).toBe(true);
    expect(result.exceedsLltv).toBe(true);
    expect(result.isSafe).toBe(false);
  });

  it('simulates repay reducing debt', () => {
    // Position: 1 ETH collateral, 1000 USDC borrowed
    const borrowShares = 1000n * 10n ** 6n; // 1:1 ratio
    const result = simulatePosition(makeInput({
      position: { collateral: 1n * 10n ** 18n, borrowShares },
      action: { addCollateral: 0n, addBorrow: 0n, repayAssets: 500n * 10n ** 6n, withdrawCollateral: 0n },
    }));

    expect(result.hasInput).toBe(true);
    expect(result.current.borrowed).toBeGreaterThan(0n);
    expect(result.projected!.borrowed).toBeLessThan(result.current.borrowed);
    expect(result.isSafe).toBe(true);
    // HF should improve after repay
    expect(result.projected!.hf).toBeGreaterThan(result.current.hf);
  });

  it('simulates full repay to zero debt', () => {
    const borrowShares = 500n * 10n ** 6n;
    const result = simulatePosition(makeInput({
      position: { collateral: 1n * 10n ** 18n, borrowShares },
      action: { addCollateral: 0n, addBorrow: 0n, repayAssets: 600n * 10n ** 6n, withdrawCollateral: 0n },
    }));

    expect(result.projected!.borrowed).toBe(0n);
    expect(result.projected!.hf).toBe(INFINITE_HEALTH_FACTOR);
    expect(result.isSafe).toBe(true);
  });

  it('simulates withdraw collateral', () => {
    const result = simulatePosition(makeInput({
      position: { collateral: 2n * 10n ** 18n, borrowShares: 0n },
      action: { addCollateral: 0n, addBorrow: 0n, repayAssets: 0n, withdrawCollateral: 1n * 10n ** 18n },
    }));

    expect(result.projected!.collateral).toBe(1n * 10n ** 18n);
    expect(result.isSafe).toBe(true);
  });

  it('detects unsafe withdrawal with remaining debt', () => {
    const borrowShares = 1600n * 10n ** 6n; // ~1600 USDC debt
    const result = simulatePosition(makeInput({
      position: { collateral: 2n * 10n ** 18n, borrowShares },
      // Withdraw 1 ETH → 1 ETH left → 1600/2000 = 80% LTV (close but under 86%)
      action: { addCollateral: 0n, addBorrow: 0n, repayAssets: 0n, withdrawCollateral: 1n * 10n ** 18n },
    }));

    // 1600/2000 = 80% < 86% → still safe
    expect(result.isSafe).toBe(true);

    // Now try withdrawing more
    const result2 = simulatePosition(makeInput({
      position: { collateral: 2n * 10n ** 18n, borrowShares },
      // Withdraw 1.1 ETH → 0.9 ETH left → 1600/1800 = 88.9% > 86%
      action: { addCollateral: 0n, addBorrow: 0n, repayAssets: 0n, withdrawCollateral: 11n * 10n ** 17n },
    }));

    expect(result2.exceedsLltv).toBe(true);
    expect(result2.isSafe).toBe(false);
  });

  it('handles zero collateral position', () => {
    const result = simulatePosition(makeInput({
      position: { collateral: 0n, borrowShares: 0n },
    }));

    expect(result.current.collateral).toBe(0n);
    expect(result.current.borrowed).toBe(0n);
    expect(result.hasInput).toBe(false);
  });

  it('handles zero oracle price', () => {
    const result = simulatePosition(makeInput({
      position: { collateral: 1n * 10n ** 18n, borrowShares: 0n },
      marketState: {
        totalBorrowAssets: 1000000n * 10n ** 6n,
        totalBorrowShares: 1000000n * 10n ** 6n,
        oraclePrice: 0n,
        lltv: LLTV_86,
      },
    }));

    expect(result.current.ltv).toBe(0n);
    expect(result.current.ltvPercent).toBe('0.0');
  });
});
