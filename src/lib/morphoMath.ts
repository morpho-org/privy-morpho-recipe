import { ORACLE_PRICE_SCALE, VIRTUAL_SHARES, VIRTUAL_ASSETS, WAD, INFINITE_HEALTH_FACTOR } from './constants';

export function mulDivDown(x: bigint, y: bigint, d: bigint): bigint {
  return (x * y) / d;
}

export function mulDivUp(x: bigint, y: bigint, d: bigint): bigint {
  return (x * y + d - 1n) / d;
}

export function wMulDown(x: bigint, y: bigint): bigint {
  return mulDivDown(x, y, WAD);
}

export function toAssetsUp(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return mulDivUp(
    shares,
    totalAssets + VIRTUAL_ASSETS,
    totalShares + VIRTUAL_SHARES,
  );
}

export function toAssetsDown(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return mulDivDown(
    shares,
    totalAssets + VIRTUAL_ASSETS,
    totalShares + VIRTUAL_SHARES,
  );
}

/**
 * Compute max additional borrowable assets, matching Morpho.sol _isHealthy:
 *   maxBorrow = collateral.mulDivDown(price, ORACLE_PRICE_SCALE).wMulDown(lltv)
 * Subtracts 1 unit because the protocol rounds in its favor (Morpho.sol line 525).
 */
export function computeMaxBorrow(
  collateral: bigint,
  oraclePrice: bigint,
  lltv: bigint,
  borrowShares: bigint,
  totalBorrowAssets: bigint,
  totalBorrowShares: bigint,
): bigint {
  if (collateral === 0n || oraclePrice === 0n) return 0n;

  const maxBorrow = wMulDown(
    mulDivDown(collateral, oraclePrice, ORACLE_PRICE_SCALE),
    lltv,
  );

  const currentBorrowed = borrowShares > 0n
    ? toAssetsUp(borrowShares, totalBorrowAssets, totalBorrowShares)
    : 0n;

  if (maxBorrow <= currentBorrowed) return 0n;
  const maxAdditional = maxBorrow - currentBorrowed;
  return maxAdditional > 1n ? maxAdditional - 1n : 0n;
}

/** LTV = borrowedAssets / collateralValue, returned as WAD-scaled (1e18 = 100%). */
export function computeLTV(
  borrowedAssets: bigint,
  collateral: bigint,
  oraclePrice: bigint,
): bigint {
  if (collateral === 0n || oraclePrice === 0n) return 0n;
  const collateralValue = mulDivDown(collateral, oraclePrice, ORACLE_PRICE_SCALE);
  if (collateralValue === 0n) return 0n;
  return mulDivDown(borrowedAssets, WAD, collateralValue);
}

export function computeHealthFactor(
  collateral: bigint,
  borrowShares: bigint,
  oraclePrice: bigint,
  lltv: bigint,
  totalBorrowAssets: bigint,
  totalBorrowShares: bigint,
): bigint {
  if (borrowShares === 0n) return INFINITE_HEALTH_FACTOR;

  const borrowedAssets = toAssetsUp(borrowShares, totalBorrowAssets, totalBorrowShares);
  if (borrowedAssets === 0n) return INFINITE_HEALTH_FACTOR;

  // maxBorrow = collateral * oraclePrice * lltv / (ORACLE_PRICE_SCALE * WAD)
  const maxBorrow = wMulDown(
    mulDivDown(collateral, oraclePrice, ORACLE_PRICE_SCALE),
    lltv,
  );

  // healthFactor = maxBorrow * WAD / borrowedAssets
  return mulDivDown(maxBorrow, WAD, borrowedAssets);
}

export function computeLiquidationPrice(
  collateral: bigint,
  borrowShares: bigint,
  lltv: bigint,
  totalBorrowAssets: bigint,
  totalBorrowShares: bigint,
): bigint {
  if (collateral === 0n || borrowShares === 0n) return 0n;

  const borrowedAssets = toAssetsUp(borrowShares, totalBorrowAssets, totalBorrowShares);

  // At liquidation: collateral * price * lltv / ORACLE_PRICE_SCALE / WAD = borrowedAssets
  // price = borrowedAssets * ORACLE_PRICE_SCALE * WAD / (collateral * lltv)
  return mulDivUp(
    borrowedAssets * ORACLE_PRICE_SCALE,
    WAD,
    collateral * lltv,
  );
}

export function formatHealthFactor(hf: bigint): string {
  // hf is WAD-scaled (1e18 = 1.0)
  if (hf === 0n) return '0.00';
  const integer = hf / WAD;
  const remainder = ((hf % WAD) * 100n) / WAD;
  // Avoid showing "0.00" for very small but non-zero HF values
  if (integer === 0n && remainder === 0n && hf > 0n) return '< 0.01';
  return `${integer}.${remainder.toString().padStart(2, '0')}`;
}

export function getHealthColor(hf: bigint): string {
  if (hf < WAD) return 'text-destructive';
  if (hf < WAD * 3n / 2n) return 'text-orange-400';
  if (hf < WAD * 2n) return 'text-yellow-400';
  return 'text-green-400';
}

export function formatLiqPrice(price: bigint, loanDecimals: number, collateralDecimals: number): string {
  const scaleFactor = 10n ** BigInt(36 + loanDecimals - collateralDecimals);
  const integer = price / scaleFactor;
  const remainder = ((price % scaleFactor) * 100n) / scaleFactor;
  return `$${integer}.${remainder.toString().padStart(2, '0')}`;
}
