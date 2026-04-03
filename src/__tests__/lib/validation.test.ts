import { describe, it, expect } from 'vitest';
import {
  validateBorrowAction,
  validateRepayAction,
  validateDepositAction,
  validateWithdrawAction,
  type BorrowValidationInput,
  type RepayValidationInput,
} from '@/lib/validation';
import { WAD } from '@/lib/constants';

const LLTV_86 = (WAD * 86n) / 100n;
const ETH_PRICE = 2000n * 10n ** 24n;

function makeBorrowInput(overrides: Partial<BorrowValidationInput> = {}): BorrowValidationInput {
  return {
    collateralAmount: '',
    borrowAmount: '',
    collateralDecimals: 18,
    loanDecimals: 6,
    collateralBalance: 10n * 10n ** 18n, // 10 ETH
    position: { collateral: 1n * 10n ** 18n, borrowShares: 0n },
    oraclePrice: ETH_PRICE,
    marketLltv: LLTV_86,
    marketBorrowData: { totalAssets: 1000000n * 10n ** 6n, totalShares: 1000000n * 10n ** 6n },
    marketLiquidity: 500000n * 10n ** 6n,
    isConnected: true,
    loanSymbol: 'USDC',
    collateralSymbol: 'WETH',
    ...overrides,
  };
}

function makeRepayInput(overrides: Partial<RepayValidationInput> = {}): RepayValidationInput {
  return {
    repayAmount: '',
    withdrawAmount: '',
    loanDecimals: 6,
    collateralDecimals: 18,
    loanBalance: 5000n * 10n ** 6n,
    position: { collateral: 1n * 10n ** 18n, borrowShares: 1000n * 10n ** 6n },
    oraclePrice: ETH_PRICE,
    marketLltv: LLTV_86,
    marketBorrowData: { totalAssets: 1000000n * 10n ** 6n, totalShares: 1000000n * 10n ** 6n },
    isConnected: true,
    loanSymbol: 'USDC',
    collateralSymbol: 'WETH',
    ...overrides,
  };
}

describe('validateBorrowAction', () => {
  it('rejects when wallet not connected', () => {
    const result = validateBorrowAction(makeBorrowInput({ isConnected: false }));
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toBe('Connect wallet');
  });

  it('rejects when no inputs', () => {
    const result = validateBorrowAction(makeBorrowInput());
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toBe('Enter an amount');
  });

  it('rejects when collateral exceeds balance', () => {
    const result = validateBorrowAction(makeBorrowInput({
      collateralAmount: '20',
      collateralBalance: 10n * 10n ** 18n,
    }));
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toContain('exceeds balance');
  });

  it('rejects borrow with no collateral and no position', () => {
    const result = validateBorrowAction(makeBorrowInput({
      borrowAmount: '1000',
      position: { collateral: 0n, borrowShares: 0n },
    }));
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toBe('Add collateral to borrow');
  });

  it('rejects borrow exceeding safe limit', () => {
    const result = validateBorrowAction(makeBorrowInput({
      borrowAmount: '1700', // Near max borrow for 1 ETH @ 2000 USDC, 86% LLTV
    }));
    expect(result.isValid).toBe(false);
  });

  it('rejects borrow exceeding market liquidity', () => {
    const result = validateBorrowAction(makeBorrowInput({
      borrowAmount: '600000',
      marketLiquidity: 500000n * 10n ** 6n,
    }));
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toBe('Insufficient market liquidity');
  });

  it('accepts valid borrow with existing collateral', () => {
    const result = validateBorrowAction(makeBorrowInput({
      borrowAmount: '500',
    }));
    expect(result.isValid).toBe(true);
    expect(result.disabledReason).toBeNull();
  });

  it('accepts valid supply + borrow', () => {
    const result = validateBorrowAction(makeBorrowInput({
      collateralAmount: '1',
      borrowAmount: '1000',
    }));
    expect(result.isValid).toBe(true);
  });

  it('accepts supply collateral only', () => {
    const result = validateBorrowAction(makeBorrowInput({
      collateralAmount: '1',
    }));
    expect(result.isValid).toBe(true);
  });
});

describe('validateRepayAction', () => {
  it('rejects when wallet not connected', () => {
    const result = validateRepayAction(makeRepayInput({ isConnected: false }));
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toBe('Connect wallet');
  });

  it('rejects when no inputs', () => {
    const result = validateRepayAction(makeRepayInput());
    expect(result.isValid).toBe(false);
  });

  it('rejects repay exceeding balance', () => {
    const result = validateRepayAction(makeRepayInput({
      repayAmount: '10000',
      loanBalance: 5000n * 10n ** 6n,
    }));
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toContain('exceeds balance');
  });

  it('rejects repay exceeding debt', () => {
    const result = validateRepayAction(makeRepayInput({
      repayAmount: '2000',
      position: { collateral: 1n * 10n ** 18n, borrowShares: 1000n * 10n ** 6n },
    }));
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toContain('exceeds outstanding debt');
  });

  it('rejects withdrawal when no collateral', () => {
    const result = validateRepayAction(makeRepayInput({
      withdrawAmount: '1',
      position: { collateral: 0n, borrowShares: 0n },
    }));
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toBe('No collateral to withdraw');
  });

  it('rejects withdrawal exceeding collateral', () => {
    const result = validateRepayAction(makeRepayInput({
      withdrawAmount: '2',
      position: { collateral: 1n * 10n ** 18n, borrowShares: 0n },
    }));
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toBe('Amount exceeds collateral');
  });

  it('accepts valid repay', () => {
    const result = validateRepayAction(makeRepayInput({
      repayAmount: '500',
    }));
    expect(result.isValid).toBe(true);
  });

  it('accepts valid withdraw with no debt', () => {
    const result = validateRepayAction(makeRepayInput({
      withdrawAmount: '0.5',
      position: { collateral: 1n * 10n ** 18n, borrowShares: 0n },
    }));
    expect(result.isValid).toBe(true);
  });
});

describe('validateDepositAction', () => {
  it('rejects when not connected', () => {
    const result = validateDepositAction({
      depositAmount: '100',
      assetDecimals: 6,
      assetBalance: 1000n * 10n ** 6n,
      isConnected: false,
      assetSymbol: 'USDC',
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects empty amount', () => {
    const result = validateDepositAction({
      depositAmount: '',
      assetDecimals: 6,
      assetBalance: 1000n * 10n ** 6n,
      isConnected: true,
      assetSymbol: 'USDC',
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects amount exceeding balance', () => {
    const result = validateDepositAction({
      depositAmount: '2000',
      assetDecimals: 6,
      assetBalance: 1000n * 10n ** 6n,
      isConnected: true,
      assetSymbol: 'USDC',
    });
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toContain('exceeds balance');
  });

  it('accepts valid deposit', () => {
    const result = validateDepositAction({
      depositAmount: '500',
      assetDecimals: 6,
      assetBalance: 1000n * 10n ** 6n,
      isConnected: true,
      assetSymbol: 'USDC',
    });
    expect(result.isValid).toBe(true);
  });
});

describe('validateWithdrawAction', () => {
  it('rejects with no position', () => {
    const result = validateWithdrawAction({
      withdrawAmount: '100',
      shares: 0n,
      maxWithdrawUsd: 0,
      isConnected: true,
    });
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toBe('No position to withdraw');
  });

  it('rejects amount exceeding position value', () => {
    const result = validateWithdrawAction({
      withdrawAmount: '2000',
      shares: 1000n * 10n ** 18n,
      maxWithdrawUsd: 1000,
      isConnected: true,
    });
    expect(result.isValid).toBe(false);
    expect(result.disabledReason).toBe('Amount exceeds position value');
  });

  it('accepts valid withdrawal', () => {
    const result = validateWithdrawAction({
      withdrawAmount: '500',
      shares: 1000n * 10n ** 18n,
      maxWithdrawUsd: 1000,
      isConnected: true,
    });
    expect(result.isValid).toBe(true);
  });
});
