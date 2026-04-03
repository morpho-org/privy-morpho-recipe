import { WAD, ORACLE_PRICE_SCALE, INFINITE_HEALTH_FACTOR } from './constants';
import {
  computeLTV,
  computeHealthFactor,
  computeLiquidationPrice,
  toAssetsUp,
  mulDivDown,
  wMulDown,
  formatHealthFactor,
  getHealthColor,
  formatLiqPrice,
} from './morphoMath';
import { formatTokenAmount } from './utils';

export interface PositionSnapshot {
  collateral: bigint;
  collateralFormatted: string;
  borrowed: bigint;
  borrowedFormatted: string;
  ltv: bigint;
  ltvPercent: string;
  hf: bigint;
  hfFormatted: string;
  hfColor: string;
  liqPrice: bigint;
  liqPriceFormatted: string;
}

export interface SimulationResult {
  current: PositionSnapshot;
  projected: PositionSnapshot | null;
  hasInput: boolean;
  isSafe: boolean;
  exceedsLltv: boolean;
  isLiquidatable: boolean;
}

export interface SimulationInput {
  position: { collateral: bigint; borrowShares: bigint };
  marketState: {
    totalBorrowAssets: bigint;
    totalBorrowShares: bigint;
    oraclePrice: bigint;
    lltv: bigint;
  };
  action: {
    addCollateral: bigint;
    addBorrow: bigint;
    repayAssets: bigint;
    withdrawCollateral: bigint;
  };
  loanDecimals: number;
  collateralDecimals: number;
}

function buildSnapshot(
  collateral: bigint,
  borrowed: bigint,
  oraclePrice: bigint,
  lltv: bigint,
  loanDecimals: number,
  collateralDecimals: number,
): PositionSnapshot {
  const ltv = computeLTV(borrowed, collateral, oraclePrice);
  const ltvPercent = collateral > 0n && oraclePrice > 0n
    ? (Number(ltv) / 1e16).toFixed(1)
    : '0.0';

  // Compute HF from raw values (not shares)
  let hf: bigint;
  if (borrowed === 0n) {
    hf = INFINITE_HEALTH_FACTOR;
  } else if (collateral === 0n || oraclePrice === 0n) {
    hf = 0n;
  } else {
    const maxBorrow = wMulDown(mulDivDown(collateral, oraclePrice, ORACLE_PRICE_SCALE), lltv);
    hf = mulDivDown(maxBorrow, WAD, borrowed);
  }

  // Compute liquidation price from raw values
  let liqPrice = 0n;
  if (collateral > 0n && borrowed > 0n && lltv > 0n) {
    liqPrice = mulDivDown(borrowed * ORACLE_PRICE_SCALE, WAD, collateral * lltv);
  }

  return {
    collateral,
    collateralFormatted: formatTokenAmount(collateral, collateralDecimals),
    borrowed,
    borrowedFormatted: formatTokenAmount(borrowed, loanDecimals),
    ltv,
    ltvPercent,
    hf,
    hfFormatted: formatHealthFactor(hf),
    hfColor: getHealthColor(hf),
    liqPrice,
    liqPriceFormatted: liqPrice > 0n ? formatLiqPrice(liqPrice, loanDecimals, collateralDecimals) : '-',
  };
}

export function simulatePosition(input: SimulationInput): SimulationResult {
  const { position, marketState, action, loanDecimals, collateralDecimals } = input;
  const { totalBorrowAssets, totalBorrowShares, oraclePrice, lltv } = marketState;

  // Current state
  const currentCollateral = position.collateral;
  const currentBorrowed = position.borrowShares > 0n
    ? toAssetsUp(position.borrowShares, totalBorrowAssets, totalBorrowShares)
    : 0n;

  const current = buildSnapshot(currentCollateral, currentBorrowed, oraclePrice, lltv, loanDecimals, collateralDecimals);

  // Check if any action inputs exist
  const hasInput = action.addCollateral > 0n || action.addBorrow > 0n
    || action.repayAssets > 0n || action.withdrawCollateral > 0n;

  if (!hasInput) {
    return {
      current,
      projected: null,
      hasInput: false,
      isSafe: current.hf >= WAD,
      exceedsLltv: current.ltv >= lltv,
      isLiquidatable: current.hf < WAD && currentBorrowed > 0n,
    };
  }

  // Projected state
  const projectedCollateral = (() => {
    let c = currentCollateral + action.addCollateral;
    c = c > action.withdrawCollateral ? c - action.withdrawCollateral : 0n;
    return c;
  })();

  const projectedBorrowed = (() => {
    const b = currentBorrowed + action.addBorrow;
    return b > action.repayAssets ? b - action.repayAssets : 0n;
  })();

  const projected = buildSnapshot(projectedCollateral, projectedBorrowed, oraclePrice, lltv, loanDecimals, collateralDecimals);

  const exceedsLltv = projected.ltv >= lltv;
  const isLiquidatable = projected.hf < WAD && projectedBorrowed > 0n;

  return {
    current,
    projected,
    hasInput: true,
    isSafe: !exceedsLltv && !isLiquidatable,
    exceedsLltv,
    isLiquidatable,
  };
}

export interface VaultSimulationResult {
  currentShares: bigint;
  currentUsdValue: number;
  projectedShares: bigint | null;
  projectedUsdValue: number | null;
  hasInput: boolean;
}

export function simulateVaultDeposit(
  currentShares: bigint,
  sharePriceUsd: number,
  depositTokenAmount: bigint,
  assetPriceUsd: number,
  assetDecimals: number,
): VaultSimulationResult {
  const currentUsdValue = Number(currentShares) / 1e18 * sharePriceUsd;
  const hasInput = depositTokenAmount > 0n;

  if (!hasInput) {
    return { currentShares, currentUsdValue, projectedShares: null, projectedUsdValue: null, hasInput: false };
  }

  const depositUsd = Number(formatTokenAmount(depositTokenAmount, assetDecimals)) * assetPriceUsd;
  const projectedUsdValue = currentUsdValue + depositUsd;
  // Estimate shares: depositUsd / sharePriceUsd * 1e18
  const projectedNewShares = sharePriceUsd > 0
    ? BigInt(Math.floor(depositUsd / sharePriceUsd * 1e18))
    : 0n;
  const projectedShares = currentShares + projectedNewShares;

  return { currentShares, currentUsdValue, projectedShares, projectedUsdValue, hasInput: true };
}

export function simulateVaultWithdraw(
  currentShares: bigint,
  sharePriceUsd: number,
  withdrawUsd: number,
): VaultSimulationResult {
  const currentUsdValue = Number(currentShares) / 1e18 * sharePriceUsd;
  const hasInput = withdrawUsd > 0;

  if (!hasInput) {
    return { currentShares, currentUsdValue, projectedShares: null, projectedUsdValue: null, hasInput: false };
  }

  const projectedUsdValue = Math.max(0, currentUsdValue - withdrawUsd);
  const sharesToBurn = sharePriceUsd > 0
    ? BigInt(Math.floor(withdrawUsd / sharePriceUsd * 1e18))
    : 0n;
  const projectedShares = currentShares > sharesToBurn ? currentShares - sharesToBurn : 0n;

  return { currentShares, currentUsdValue, projectedShares, projectedUsdValue, hasInput: true };
}
