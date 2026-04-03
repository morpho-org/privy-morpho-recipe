'use client';

import { useEffect, useState, useMemo } from 'react';

import { usePrivy } from '@privy-io/react-auth';
import { useSmartAccount } from '@/hooks/useSmartAccount';
import { useMarkets } from '@/hooks/useMarkets';
import { useMarketPosition } from '@/hooks/useMarketPosition';
import {
  formatTokenAmount,
  parseTokenAmount,
  getExplorerTxUrl,
  isZero,
  formatPercent,
} from '@/lib/utils';
import { WAD, SIMULATE_ONLY_SENTINEL, BORROW_SAFETY_BUFFER, BORROW_SAFETY_DIVISOR, STATUS_STYLES } from '@/lib/constants';
import { computeMaxBorrow } from '@/lib/morphoMath';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { SimulationSummary } from './SimulationSummary';
import { ReviewStep } from './ReviewStep';

interface MarketOperationsModalProps {
  marketKey: string;
}

export default function MarketOperationsModal({ marketKey }: MarketOperationsModalProps) {
  const { authenticated, login } = usePrivy();
  const { isReady, address } = useSmartAccount();

  const {
    selectedMarketKey,
    setSelectedMarketKey,
    selectedMarket,
    loanDecimals,
    collateralDecimals,
    loanSymbol,
    collateralSymbol,
    loanToken,
    collateralToken,
    oracleAddress,
    marketLltv,
    marketId,
    marketParamsArg,
    lltvPercent,
  } = useMarkets();

  const [marketTab, setMarketTab] = useState<'borrow' | 'repay'>('borrow');
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => {
    if (marketKey && marketKey !== selectedMarketKey) {
      setSelectedMarketKey(marketKey);
    }
  }, [marketKey, selectedMarketKey, setSelectedMarketKey]);

  const {
    collateralAmount, setCollateralAmount,
    borrowAmount, setBorrowAmount,
    repayAmount, setRepayAmount,
    withdrawAmount, setWithdrawAmount,
    status, statusKind, txHash, isLoading, explorerUrl,
    collateralBalance, loanBalance, position,
    oraclePrice, marketBorrowData,
    currentDebtAssets,
    maxRepayAmount, maxBorrowAmount, maxWithdrawCollateral,
    simulation,
    borrowValidation, repayValidation,
    borrowCtaLabel, repayCtaLabel,
    borrowTxSteps, repayTxSteps,
    fetchBalances, fetchPosition,
    handleBorrowExecute,
    handleRepayExecute,
    handleRepayAll,
    handleWithdrawAllCollateral,
  } = useMarketPosition({
    marketId, marketParamsArg,
    loanToken, collateralToken, oracleAddress,
    marketLltv, loanDecimals, collateralDecimals,
    loanSymbol, collateralSymbol, selectedMarketKey,
    activeTab: marketTab,
  });

  const isAuthed = authenticated && !!address && isReady;

  // Exit review mode when tab changes or market changes
  useEffect(() => { setReviewMode(false); }, [marketTab, selectedMarketKey]);

  // Effective max borrow including new collateral from input
  const effectiveMaxBorrow = useMemo(() => {
    if (!oraclePrice || oraclePrice === 0n || !marketBorrowData || !marketLltv) return null;
    try {
      const existingCollateral = position?.collateral ?? 0n;
      const newCollateral = collateralAmount && parseFloat(collateralAmount) > 0
        ? parseTokenAmount(collateralAmount, collateralDecimals)
        : 0n;
      const totalCollateral = existingCollateral + newCollateral;
      if (totalCollateral === 0n) return null;
      const raw = computeMaxBorrow(
        totalCollateral, oraclePrice, marketLltv,
        position?.borrowShares ?? 0n, marketBorrowData.totalAssets, marketBorrowData.totalShares,
      );
      const safe = raw * BORROW_SAFETY_BUFFER / BORROW_SAFETY_DIVISOR;
      return Math.max(0, parseFloat(formatTokenAmount(safe, loanDecimals)));
    } catch { return null; }
  }, [oraclePrice, marketBorrowData, marketLltv, position, collateralAmount, collateralDecimals, loanDecimals]);

  const displayMaxBorrow = effectiveMaxBorrow ?? maxBorrowAmount;

  const handleSetMaxBorrow = () => {
    if (displayMaxBorrow !== null && displayMaxBorrow > 0) {
      setBorrowAmount(displayMaxBorrow.toFixed(Math.min(loanDecimals, 6)));
    }
  };

  // Max repay capped by both debt and wallet balance
  const safeMaxRepay = useMemo(() => {
    if (currentDebtAssets === 0n) return null;
    const debtFormatted = parseFloat(formatTokenAmount(currentDebtAssets, loanDecimals));
    if (maxRepayAmount === null) return debtFormatted;
    return Math.min(debtFormatted, maxRepayAmount);
  }, [currentDebtAssets, maxRepayAmount, loanDecimals]);

  const handleSetMaxRepay = () => {
    if (safeMaxRepay !== null && safeMaxRepay > 0) {
      setRepayAmount(safeMaxRepay.toFixed(Math.min(loanDecimals, 6)));
    }
  };

  // Review step action summary
  const actionSummary = useMemo(() => {
    if (marketTab === 'borrow') {
      const parts: string[] = [];
      if (collateralAmount && parseFloat(collateralAmount) > 0) {
        parts.push(`Supply ${collateralAmount} ${collateralSymbol} collateral`);
      }
      if (borrowAmount && parseFloat(borrowAmount) > 0) {
        parts.push(`Borrow ${borrowAmount} ${loanSymbol}`);
      }
      return parts.join(' and ') || 'No action';
    } else {
      const parts: string[] = [];
      if (repayAmount && parseFloat(repayAmount) > 0) {
        parts.push(`Repay ${repayAmount} ${loanSymbol}`);
      }
      if (withdrawAmount && parseFloat(withdrawAmount) > 0) {
        parts.push(`Withdraw ${withdrawAmount} ${collateralSymbol}`);
      }
      return parts.join(' and ') || 'No action';
    }
  }, [marketTab, collateralAmount, borrowAmount, repayAmount, withdrawAmount, collateralSymbol, loanSymbol]);

  // Borrow rate from market data
  const borrowApy = selectedMarket?.state?.borrowApy != null
    ? formatPercent(selectedMarket.state.borrowApy)
    : undefined;

  const activeValidation = marketTab === 'borrow' ? borrowValidation : repayValidation;
  const activeCtaLabel = marketTab === 'borrow' ? borrowCtaLabel : repayCtaLabel;
  const activeTxSteps = marketTab === 'borrow' ? borrowTxSteps : repayTxSteps;
  const canExecute = activeValidation.isValid && !isLoading && !!selectedMarket;

  const handleCtaClick = () => {
    if (!canExecute) return;
    setReviewMode(true);
  };

  const handleConfirm = async () => {
    if (marketTab === 'borrow') {
      await handleBorrowExecute();
    } else {
      await handleRepayExecute();
    }
    setReviewMode(false);
  };

  return (
    <div className="surface-card w-full p-5 h-full overflow-y-auto">
      <div className="space-y-5">
        <div>
          <h3 className="text-label mb-1">Market Operations</h3>
          {selectedMarket && (
            <p className="text-sm font-medium text-foreground">
              {collateralSymbol} / {loanSymbol}
              <span className="text-muted-foreground ml-2 text-xs">({lltvPercent}% LLTV)</span>
            </p>
          )}
          {isAuthed && (
            <p className="text-xs text-muted-foreground font-mono break-all select-all mt-1">{address}</p>
          )}
        </div>

        {!isAuthed ? (
          /* Unauthenticated state */
          <div className="space-y-4">
            {selectedMarket && (
              <div className="surface-elevated p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Loan Asset</span>
                  <span className="font-medium text-foreground">{loanSymbol}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Collateral</span>
                  <span className="font-medium text-foreground">{collateralSymbol}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">LLTV</span>
                  <span className="font-medium text-foreground font-mono">{lltvPercent}%</span>
                </div>
              </div>
            )}
            <Button variant="default" size="lg" className="w-full" onClick={login}>
              Connect Wallet
            </Button>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Connect your wallet to supply, borrow, or repay
            </p>
          </div>
        ) : reviewMode ? (
          /* Review step */
          <ReviewStep
            actionSummary={actionSummary}
            simulation={simulation}
            txSteps={activeTxSteps}
            lltvPercent={lltvPercent}
            borrowApy={borrowApy}
            collateralSymbol={collateralSymbol}
            loanSymbol={loanSymbol}
            marketLltv={marketLltv}
            isLoading={isLoading}
            onConfirm={handleConfirm}
            onBack={() => setReviewMode(false)}
          />
        ) : (
          <>
            <div className="flex gap-1 bg-white/[0.05] rounded-lg p-1">
              <button
                className={`flex-1 text-sm transition-colors ${marketTab === 'borrow' ? 'bg-white/[0.1] text-foreground font-medium rounded-md px-4 py-1.5' : 'text-muted-foreground px-4 py-1.5 hover:text-foreground'}`}
                onClick={() => setMarketTab('borrow')}
              >
                Borrow
              </button>
              <button
                className={`flex-1 text-sm transition-colors ${marketTab === 'repay' ? 'bg-white/[0.1] text-foreground font-medium rounded-md px-4 py-1.5' : 'text-muted-foreground px-4 py-1.5 hover:text-foreground'}`}
                onClick={() => setMarketTab('repay')}
              >
                Repay
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 px-1">
              <span>
                {collateralSymbol}: {collateralBalance !== null ? formatTokenAmount(collateralBalance, collateralDecimals) : '—'}
              </span>
              <span>
                {loanSymbol}: {loanBalance !== null ? formatTokenAmount(loanBalance, loanDecimals) : '—'}
              </span>
              <button
                onClick={() => { fetchBalances(true); fetchPosition(true); }}
                className="hover:text-foreground transition-colors"
                title="Refresh"
              >
                ↻
              </button>
            </div>

            {marketTab === 'borrow' ? (
              <>
                <div className="space-y-2">
                  <label className="text-label block">Supply {collateralSymbol} Collateral</label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 surface-elevated rounded-md px-3 py-2">
                      <input
                        type="number"
                        value={collateralAmount}
                        onChange={(e) => setCollateralAmount(e.target.value)}
                        placeholder={`Amount in ${collateralSymbol}`}
                        step="0.01"
                        className="flex-1 bg-transparent text-foreground font-mono text-xs outline-none min-w-0"
                      />
                      <span className="text-[10px] text-muted-foreground">{collateralSymbol}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <label className="text-label block">Borrow {loanSymbol}</label>
                    <div className="text-right">
                      {displayMaxBorrow !== null && displayMaxBorrow > 0 ? (
                        <span className="text-[10px] text-muted-foreground/60 font-mono block">
                          Max: ~{displayMaxBorrow.toFixed(Math.min(loanDecimals, 2))} {loanSymbol}
                        </span>
                      ) : (position && position.collateral === 0n && (!collateralAmount || parseFloat(collateralAmount) <= 0)) ? (
                        <span className="text-[10px] text-muted-foreground/60">Add collateral to borrow</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 surface-elevated rounded-md px-3 py-2">
                      <input
                        type="number"
                        value={borrowAmount}
                        onChange={(e) => setBorrowAmount(e.target.value)}
                        placeholder={`Amount in ${loanSymbol}`}
                        className="flex-1 bg-transparent text-foreground font-mono text-xs outline-none min-w-0"
                      />
                      <span className="text-[10px] text-muted-foreground">{loanSymbol}</span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSetMaxBorrow}
                      disabled={!displayMaxBorrow || displayMaxBorrow <= 0}
                    >
                      Max
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <label className="text-label block">Repay {loanSymbol}</label>
                    <div className="text-right">
                      {currentDebtAssets > 0n && (
                        <span className="text-[10px] text-muted-foreground/60 font-mono block">
                          Debt: {formatTokenAmount(currentDebtAssets, loanDecimals)} {loanSymbol}
                        </span>
                      )}
                      {safeMaxRepay !== null && (
                        <span className="text-[10px] text-muted-foreground/60 font-mono block">
                          Max repay: {safeMaxRepay.toFixed(Math.min(loanDecimals, 6))} {loanSymbol}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 surface-elevated rounded-md px-3 py-2">
                      <input
                        type="number"
                        value={repayAmount}
                        onChange={(e) => setRepayAmount(e.target.value)}
                        placeholder={`Amount in ${loanSymbol}`}
                        className="flex-1 bg-transparent text-foreground font-mono text-xs outline-none min-w-0"
                      />
                      <span className="text-[10px] text-muted-foreground">{loanSymbol}</span>
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleSetMaxRepay} disabled={!safeMaxRepay || safeMaxRepay <= 0}>
                      Max
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <label className="text-label block">Withdraw {collateralSymbol}</label>
                    {maxWithdrawCollateral !== null && (
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        Max: {maxWithdrawCollateral.toFixed(Math.min(collateralDecimals, 6))} {collateralSymbol}
                      </span>
                    )}
                  </div>
                  {(!position || isZero(position.collateral)) && (
                    <div className="surface-elevated border-accent/30 p-2 text-xs text-muted-foreground">
                      No {collateralSymbol} collateral found. Supply collateral first.
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 surface-elevated rounded-md px-3 py-2">
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder={`Amount in ${collateralSymbol}`}
                        step="0.01"
                        className="flex-1 bg-transparent text-foreground font-mono text-xs outline-none min-w-0"
                      />
                      <span className="text-[10px] text-muted-foreground">{collateralSymbol}</span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (maxWithdrawCollateral) setWithdrawAmount(maxWithdrawCollateral.toString());
                      }}
                      disabled={!position || isZero(position.collateral)}
                    >
                      Max
                    </Button>
                  </div>
                </div>
              </>
            )}

            {simulation ? (
              <SimulationSummary
                simulation={simulation}
                lltvPercent={lltvPercent}
                borrowApy={borrowApy}
                collateralSymbol={collateralSymbol}
                loanSymbol={loanSymbol}
                marketLltv={marketLltv}
              />
            ) : isAuthed ? (
              <div className="surface-elevated p-3 text-xs text-muted-foreground text-center">
                Loading position data...
              </div>
            ) : null}

            {activeTxSteps.length > 0 && canExecute && (
              <div className="surface-elevated rounded-md p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Transaction Steps</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {activeTxSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] font-mono">
                        {i + 1}
                      </span>
                      <span>{step.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Button
                variant="accent"
                size="sm"
                className="w-full"
                onClick={handleCtaClick}
                disabled={!canExecute}
              >
                {isLoading ? (
                  <Spinner />
                ) : (
                  activeCtaLabel
                )}
              </Button>
              {!activeValidation.isValid && activeValidation.disabledReason && (
                <p className="text-[10px] text-muted-foreground/60 text-center">
                  {activeValidation.disabledReason}
                </p>
              )}
            </div>

            {status && statusKind !== 'idle' && (
              <div className={`rounded-md p-3 ${STATUS_STYLES[statusKind]}`}>
                <p className="text-xs">
                  {isLoading && (
                    <Spinner className="w-3 h-3 mr-2 align-middle" />
                  )}
                  {status}
                </p>
                {txHash && txHash !== SIMULATE_ONLY_SENTINEL && explorerUrl && (
                  <p className="text-xs mt-1">
                    <a
                      href={getExplorerTxUrl(explorerUrl, txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:opacity-80"
                    >
                      View Transaction
                    </a>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
