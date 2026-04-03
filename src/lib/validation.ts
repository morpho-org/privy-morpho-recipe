import { parseUnits } from 'viem';
import { WAD, BORROW_SAFETY_BUFFER, BORROW_SAFETY_DIVISOR } from './constants';
import { computeMaxBorrow, computeLTV, toAssetsUp, wMulDown, mulDivDown } from './morphoMath';

export interface ValidationResult {
  isValid: boolean;
  disabledReason: string | null;
  warnings: string[];
}

const VALID: ValidationResult = { isValid: true, disabledReason: null, warnings: [] };

function invalid(reason: string, warnings: string[] = []): ValidationResult {
  return { isValid: false, disabledReason: reason, warnings };
}

function parseInput(input: string, decimals: number): bigint | null {
  if (!input || input.trim() === '') return null;
  const num = Number(input);
  if (isNaN(num) || num <= 0) return null;
  const parts = input.split('.');
  if (parts[1] && parts[1].length > decimals) return null;
  try {
    return parseUnits(input, decimals);
  } catch {
    return null;
  }
}


export interface BorrowValidationInput {
  collateralAmount: string;
  borrowAmount: string;
  collateralDecimals: number;
  loanDecimals: number;
  collateralBalance: bigint | null;
  position: { collateral: bigint; borrowShares: bigint } | null;
  oraclePrice: bigint | null;
  marketLltv: bigint;
  marketBorrowData: { totalAssets: bigint; totalShares: bigint } | null;
  marketLiquidity: bigint | null; // available liquidity in loan token units
  isConnected: boolean;
  loanSymbol: string;
  collateralSymbol: string;
}

export function validateBorrowAction(input: BorrowValidationInput): ValidationResult {
  if (!input.isConnected) return invalid('Connect wallet');

  const hasCollateral = input.collateralAmount && parseFloat(input.collateralAmount) > 0;
  const hasBorrow = input.borrowAmount && parseFloat(input.borrowAmount) > 0;

  if (!hasCollateral && !hasBorrow) return invalid('Enter an amount');

  const warnings: string[] = [];

  // Validate collateral input
  if (hasCollateral) {
    const collateralParsed = parseInput(input.collateralAmount, input.collateralDecimals);
    if (!collateralParsed) return invalid(`Invalid ${input.collateralSymbol} amount`);
    if (input.collateralBalance !== null && collateralParsed > input.collateralBalance) {
      return invalid(`${input.collateralSymbol} amount exceeds balance`);
    }
  }

  // Validate borrow input
  if (hasBorrow) {
    const borrowParsed = parseInput(input.borrowAmount, input.loanDecimals);
    if (!borrowParsed) return invalid(`Invalid ${input.loanSymbol} amount`);

    // Check market liquidity
    if (input.marketLiquidity !== null && borrowParsed > input.marketLiquidity) {
      return invalid('Insufficient market liquidity');
    }

    // Check LLTV safety
    if (input.oraclePrice && input.oraclePrice > 0n && input.marketBorrowData) {
      const existingCollateral = input.position?.collateral ?? 0n;
      const newCollateral = hasCollateral
        ? (parseInput(input.collateralAmount, input.collateralDecimals) ?? 0n)
        : 0n;
      const totalCollateral = existingCollateral + newCollateral;

      if (totalCollateral === 0n) {
        return invalid('Add collateral to borrow');
      }

      const maxBorrow = computeMaxBorrow(
        totalCollateral, input.oraclePrice, input.marketLltv,
        input.position?.borrowShares ?? 0n,
        input.marketBorrowData.totalAssets, input.marketBorrowData.totalShares,
      );
      const safeBorrow = maxBorrow * BORROW_SAFETY_BUFFER / BORROW_SAFETY_DIVISOR;

      if (borrowParsed > safeBorrow) {
        // Check if it's specifically over LLTV (not just over safe buffer)
        const currentBorrowed = input.position?.borrowShares
          ? toAssetsUp(input.position.borrowShares, input.marketBorrowData.totalAssets, input.marketBorrowData.totalShares)
          : 0n;
        const projectedBorrowed = currentBorrowed + borrowParsed;
        const projectedLTV = computeLTV(projectedBorrowed, totalCollateral, input.oraclePrice);

        if (projectedLTV >= input.marketLltv) {
          return invalid('Position would exceed LLTV — risk of liquidation');
        }
        return invalid('Borrow amount exceeds safe limit');
      }
    } else if (!input.position || input.position.collateral === 0n) {
      if (!hasCollateral) return invalid('Add collateral to borrow');
    }
  }

  return warnings.length > 0 ? { isValid: true, disabledReason: null, warnings } : VALID;
}


export interface RepayValidationInput {
  repayAmount: string;
  withdrawAmount: string;
  loanDecimals: number;
  collateralDecimals: number;
  loanBalance: bigint | null;
  position: { collateral: bigint; borrowShares: bigint } | null;
  oraclePrice: bigint | null;
  marketLltv: bigint;
  marketBorrowData: { totalAssets: bigint; totalShares: bigint } | null;
  isConnected: boolean;
  loanSymbol: string;
  collateralSymbol: string;
}

export function validateRepayAction(input: RepayValidationInput): ValidationResult {
  if (!input.isConnected) return invalid('Connect wallet');

  const hasRepay = input.repayAmount && parseFloat(input.repayAmount) > 0;
  const hasWithdraw = input.withdrawAmount && parseFloat(input.withdrawAmount) > 0;

  if (!hasRepay && !hasWithdraw) return invalid('Enter an amount');

  // Validate repay input
  if (hasRepay) {
    const repayParsed = parseInput(input.repayAmount, input.loanDecimals);
    if (!repayParsed) return invalid(`Invalid ${input.loanSymbol} amount`);

    if (input.loanBalance !== null && repayParsed > input.loanBalance) {
      return invalid(`${input.loanSymbol} amount exceeds balance`);
    }

    if (input.position && input.marketBorrowData && input.position.borrowShares > 0n) {
      const currentDebt = toAssetsUp(
        input.position.borrowShares,
        input.marketBorrowData.totalAssets,
        input.marketBorrowData.totalShares,
      );
      if (repayParsed > currentDebt) {
        return invalid(`Amount exceeds outstanding debt`);
      }
    }
  }

  // Validate withdraw input
  if (hasWithdraw) {
    const withdrawParsed = parseInput(input.withdrawAmount, input.collateralDecimals);
    if (!withdrawParsed) return invalid(`Invalid ${input.collateralSymbol} amount`);

    if (!input.position || input.position.collateral === 0n) {
      return invalid('No collateral to withdraw');
    }
    if (withdrawParsed > input.position.collateral) {
      return invalid(`Amount exceeds collateral`);
    }

    // Check if withdrawing would make position unsafe (when there's still debt)
    if (input.position.borrowShares > 0n && input.oraclePrice && input.oraclePrice > 0n && input.marketBorrowData) {
      const projectedCollateral = input.position.collateral - withdrawParsed;
      const currentBorrowed = toAssetsUp(
        input.position.borrowShares,
        input.marketBorrowData.totalAssets,
        input.marketBorrowData.totalShares,
      );

      // Account for repay reducing debt
      const repayAssets = hasRepay
        ? (parseInput(input.repayAmount, input.loanDecimals) ?? 0n)
        : 0n;
      const projectedBorrowed = currentBorrowed > repayAssets ? currentBorrowed - repayAssets : 0n;

      if (projectedBorrowed > 0n && projectedCollateral > 0n) {
        const projectedLTV = computeLTV(projectedBorrowed, projectedCollateral, input.oraclePrice);
        if (projectedLTV >= input.marketLltv) {
          return invalid('Withdrawal would exceed LLTV — risk of liquidation');
        }
      }
    }
  }

  return VALID;
}


export interface DepositValidationInput {
  depositAmount: string;
  assetDecimals: number;
  assetBalance: bigint | null;
  isConnected: boolean;
  assetSymbol: string;
}

export function validateDepositAction(input: DepositValidationInput): ValidationResult {
  if (!input.isConnected) return invalid('Connect wallet');
  if (!input.depositAmount || parseFloat(input.depositAmount) <= 0) return invalid('Enter an amount');

  const parsed = parseInput(input.depositAmount, input.assetDecimals);
  if (!parsed) return invalid(`Invalid ${input.assetSymbol} amount`);

  if (input.assetBalance !== null && parsed > input.assetBalance) {
    return invalid(`${input.assetSymbol} amount exceeds balance`);
  }

  return VALID;
}


export interface WithdrawValidationInput {
  withdrawAmount: string;
  shares: bigint | null;
  maxWithdrawUsd: number;
  isConnected: boolean;
}

export function validateWithdrawAction(input: WithdrawValidationInput): ValidationResult {
  if (!input.isConnected) return invalid('Connect wallet');
  if (!input.withdrawAmount || parseFloat(input.withdrawAmount) <= 0) return invalid('Enter an amount');

  const amount = parseFloat(input.withdrawAmount);
  if (isNaN(amount)) return invalid('Invalid amount');

  if (!input.shares || input.shares === 0n) return invalid('No position to withdraw');

  if (amount > input.maxWithdrawUsd) {
    return invalid('Amount exceeds position value');
  }

  return VALID;
}
