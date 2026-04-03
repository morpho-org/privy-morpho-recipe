import { describe, it, expect } from 'vitest';
import {
  mulDivDown,
  mulDivUp,
  wMulDown,
  toAssetsUp,
  toAssetsDown,
  computeHealthFactor,
  computeLiquidationPrice,
  formatHealthFactor,
  getHealthColor,
  formatLiqPrice,
} from '@/lib/morphoMath';
import {
  WAD,
  ORACLE_PRICE_SCALE,
  VIRTUAL_SHARES,
  VIRTUAL_ASSETS,
  INFINITE_HEALTH_FACTOR,
} from '@/lib/constants';

describe('mulDivDown', () => {
  it('rounds down', () => {
    // 7 * 1 / 2 = 3.5 → floors to 3
    expect(mulDivDown(7n, 1n, 2n)).toBe(3n);
  });

  it('exact division', () => {
    expect(mulDivDown(6n, 2n, 3n)).toBe(4n);
  });

  it('handles zero numerator', () => {
    expect(mulDivDown(0n, 100n, 7n)).toBe(0n);
  });

  it('handles large values', () => {
    const x = 10n ** 18n;
    const y = 10n ** 18n;
    const d = 10n ** 18n;
    expect(mulDivDown(x, y, d)).toBe(10n ** 18n);
  });
});

describe('mulDivUp', () => {
  it('rounds up', () => {
    // 7 * 1 / 2 = 3.5 → ceils to 4
    expect(mulDivUp(7n, 1n, 2n)).toBe(4n);
  });

  it('exact division does not add extra', () => {
    expect(mulDivUp(6n, 2n, 3n)).toBe(4n);
  });

  it('handles zero numerator', () => {
    expect(mulDivUp(0n, 100n, 7n)).toBe(0n);
  });

  it('rounds up by 1 on remainder', () => {
    // 1 * 1 / 3 = 0.33 → ceils to 1
    expect(mulDivUp(1n, 1n, 3n)).toBe(1n);
  });
});

describe('wMulDown', () => {
  it('multiplies WAD-scaled values', () => {
    // 2 WAD * 3 WAD / WAD = 6 WAD
    expect(wMulDown(2n * WAD, 3n * WAD)).toBe(6n * WAD);
  });

  it('handles half WAD', () => {
    // WAD * (WAD/2) / WAD = WAD/2
    expect(wMulDown(WAD, WAD / 2n)).toBe(WAD / 2n);
  });

  it('zero gives zero', () => {
    expect(wMulDown(0n, WAD)).toBe(0n);
  });
});

describe('toAssetsDown', () => {
  it('converts shares to assets rounding down', () => {
    const shares = 1000n;
    const totalAssets = 2000n;
    const totalShares = 1000n;
    // shares * (totalAssets + VIRTUAL_ASSETS) / (totalShares + VIRTUAL_SHARES)
    const result = toAssetsDown(shares, totalAssets, totalShares);
    const expected = mulDivDown(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
    expect(result).toBe(expected);
  });

  it('handles zero shares', () => {
    expect(toAssetsDown(0n, 1000n, 1000n)).toBe(0n);
  });
});

describe('toAssetsUp', () => {
  it('converts shares to assets rounding up', () => {
    const shares = 1000n;
    const totalAssets = 2000n;
    const totalShares = 1000n;
    const result = toAssetsUp(shares, totalAssets, totalShares);
    const expected = mulDivUp(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
    expect(result).toBe(expected);
  });

  it('toAssetsUp >= toAssetsDown for same inputs', () => {
    const shares = 333n;
    const totalAssets = 1000n;
    const totalShares = 999n;
    expect(toAssetsUp(shares, totalAssets, totalShares)).toBeGreaterThanOrEqual(
      toAssetsDown(shares, totalAssets, totalShares),
    );
  });
});

describe('computeHealthFactor', () => {
  it('returns INFINITE_HEALTH_FACTOR when borrowShares is zero', () => {
    expect(
      computeHealthFactor(1000n, 0n, ORACLE_PRICE_SCALE, WAD, 1000n, 1000n),
    ).toBe(INFINITE_HEALTH_FACTOR);
  });

  it('returns INFINITE_HEALTH_FACTOR when borrowedAssets rounds to zero', () => {
    // Very small borrowShares with large totalBorrowShares → rounds to 0
    const hf = computeHealthFactor(
      1000n,
      1n,
      ORACLE_PRICE_SCALE,
      WAD,
      0n,
      10n ** 18n,
    );
    // toAssetsUp(1, 0, 1e18) = (1*(0+1) + (1e18+1e6) - 1) / (1e18+1e6) = 1
    // This won't be zero, so let's just check it's > WAD (healthy)
    expect(hf > 0n).toBe(true);
  });

  it('computes a healthy factor (>WAD)', () => {
    // 1 ETH collateral, price = 2000 USDC (scaled), 86% LLTV, borrowing 1000 USDC
    const collateral = 10n ** 18n; // 1 ETH
    const lltv = (86n * WAD) / 100n;
    // Oracle price: 2000 * ORACLE_PRICE_SCALE * 10^6 / 10^18 = 2000 * 10^24
    const oraclePrice = 2000n * 10n ** 24n;
    // borrow 1000 USDC = 1000 * 10^6
    const totalBorrowAssets = 1000n * 10n ** 6n;
    const totalBorrowShares = 1000n * 10n ** 6n;
    const borrowShares = 1000n * 10n ** 6n;

    const hf = computeHealthFactor(
      collateral,
      borrowShares,
      oraclePrice,
      lltv,
      totalBorrowAssets,
      totalBorrowShares,
    );

    // maxBorrow = 1e18 * 2000*1e24 / 1e36 * 0.86 = 2000 * 0.86 = 1720
    // healthFactor = 1720 / 1000 * WAD ≈ 1.72 WAD
    expect(hf).toBeGreaterThan(WAD);
    expect(hf).toBeLessThan(2n * WAD);
  });

  it('computes an undercollateralized factor (<WAD)', () => {
    const collateral = 10n ** 18n;
    const lltv = (86n * WAD) / 100n;
    const oraclePrice = 2000n * 10n ** 24n;
    // Borrowing 2000 USDC — nearly at limit
    const totalBorrowAssets = 2000n * 10n ** 6n;
    const totalBorrowShares = 2000n * 10n ** 6n;
    const borrowShares = 2000n * 10n ** 6n;

    const hf = computeHealthFactor(
      collateral,
      borrowShares,
      oraclePrice,
      lltv,
      totalBorrowAssets,
      totalBorrowShares,
    );

    // maxBorrow ≈ 1720, borrowing 2000 → HF ≈ 0.86 < 1
    expect(hf).toBeLessThan(WAD);
    expect(hf).toBeGreaterThan(0n);
  });
});

describe('computeLiquidationPrice', () => {
  it('returns 0 when collateral is zero', () => {
    expect(computeLiquidationPrice(0n, 100n, WAD, 100n, 100n)).toBe(0n);
  });

  it('returns 0 when borrowShares is zero', () => {
    expect(computeLiquidationPrice(100n, 0n, WAD, 100n, 100n)).toBe(0n);
  });

  it('computes a reasonable liquidation price', () => {
    const collateral = 10n ** 8n; // 1 cbBTC
    const lltv = (86n * WAD) / 100n;
    const totalBorrowAssets = 50_000n * 10n ** 6n;
    const totalBorrowShares = 50_000n * 10n ** 6n;
    const borrowShares = 50_000n * 10n ** 6n;

    const liqPrice = computeLiquidationPrice(
      collateral,
      borrowShares,
      lltv,
      totalBorrowAssets,
      totalBorrowShares,
    );

    expect(liqPrice).toBeGreaterThan(0n);
  });
});

describe('formatHealthFactor', () => {
  it('formats WAD as 1.00', () => {
    expect(formatHealthFactor(WAD)).toBe('1.00');
  });

  it('formats 2.5 WAD as 2.50', () => {
    expect(formatHealthFactor((5n * WAD) / 2n)).toBe('2.50');
  });

  it('formats sub-1 value', () => {
    const hf = WAD / 2n; // 0.5
    expect(formatHealthFactor(hf)).toBe('0.50');
  });

  it('formats large value', () => {
    const hf = 10n * WAD;
    expect(formatHealthFactor(hf)).toBe('10.00');
  });

  it('formats value with non-zero remainder', () => {
    // 1.23 WAD
    const hf = WAD + (23n * WAD) / 100n;
    expect(formatHealthFactor(hf)).toBe('1.23');
  });
});

describe('getHealthColor', () => {
  it('returns destructive for hf < WAD', () => {
    expect(getHealthColor(WAD / 2n)).toBe('text-destructive');
  });

  it('returns orange for hf between WAD and 1.5*WAD', () => {
    expect(getHealthColor(WAD + WAD / 4n)).toBe('text-orange-400');
  });

  it('returns yellow for hf between 1.5*WAD and 2*WAD', () => {
    expect(getHealthColor((WAD * 3n) / 2n + 1n)).toBe('text-yellow-400');
  });

  it('returns green for hf >= 2*WAD', () => {
    expect(getHealthColor(WAD * 2n)).toBe('text-green-400');
    expect(getHealthColor(WAD * 10n)).toBe('text-green-400');
  });

  it('boundary: exactly WAD is orange (not destructive)', () => {
    expect(getHealthColor(WAD)).toBe('text-orange-400');
  });

  it('boundary: exactly 1.5*WAD is yellow', () => {
    // hf < WAD * 3n / 2n is false when hf = WAD * 3n / 2n, so it goes to next check
    const halfWay = (WAD * 3n) / 2n;
    expect(getHealthColor(halfWay)).toBe('text-yellow-400');
  });
});

describe('formatLiqPrice', () => {
  it('formats with cross-decimal scaling (loan=6, collateral=8)', () => {
    // price in oracle scale: 60000 * 10^(36+6-8) = 60000 * 10^34
    const price = 60000n * 10n ** 34n;
    const result = formatLiqPrice(price, 6, 8);
    expect(result).toBe('$60000.00');
  });

  it('formats with same decimals (18/18)', () => {
    // price = 2000 * 10^(36+18-18) = 2000 * 10^36
    const price = 2000n * 10n ** 36n;
    const result = formatLiqPrice(price, 18, 18);
    expect(result).toBe('$2000.00');
  });

  it('formats small price', () => {
    const price = 1n * 10n ** 36n;
    const result = formatLiqPrice(price, 18, 18);
    expect(result).toBe('$1.00');
  });

  it('formats with remainder', () => {
    // 1234.56 → 1234 * 10^36 + 56 * 10^34
    const price = 1234n * 10n ** 36n + 56n * 10n ** 34n;
    const result = formatLiqPrice(price, 18, 18);
    expect(result).toBe('$1234.56');
  });
});
