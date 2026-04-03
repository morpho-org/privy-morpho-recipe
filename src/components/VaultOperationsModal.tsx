'use client';

import { useEffect, useState, useMemo } from 'react';

import { usePrivy } from '@privy-io/react-auth';
import { useSmartAccount } from '@/hooks/useSmartAccount';
import { useVaults } from '@/hooks/useVaults';
import { useVaultPosition } from '@/hooks/useVaultPosition';
import { formatTokenAmount, formatVaultShares, getExplorerTxUrl, formatPercent, formatUsd } from '@/lib/utils';
import { SIMULATE_ONLY_SENTINEL, STATUS_STYLES } from '@/lib/constants';
import { validateDepositAction, validateWithdrawAction } from '@/lib/validation';
import { simulateVaultDeposit, simulateVaultWithdraw } from '@/lib/simulate';
import { parseTokenAmount } from '@/lib/utils';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { ValueTransition } from './ui/ValueTransition';

interface VaultOperationsModalProps {
  vaultAddress: string;
}

export default function VaultOperationsModal({ vaultAddress }: VaultOperationsModalProps) {
  const { authenticated, login } = usePrivy();
  const { isReady, address } = useSmartAccount();

  const {
    selectedVaultAddress,
    setSelectedVaultAddress,
    selectedVault,
    assetDecimals,
    assetSymbol,
    assetAddress,
    sharePriceUsd,
    assetPriceUsd,
  } = useVaults();

  useEffect(() => {
    if (vaultAddress && vaultAddress !== selectedVaultAddress) {
      setSelectedVaultAddress(vaultAddress);
    }
  }, [vaultAddress, selectedVaultAddress, setSelectedVaultAddress]);

  const {
    depositAmount, setDepositAmount,
    withdrawAmount, setWithdrawAmount,
    status, statusKind, txHash,
    shares, assetBalance,
    isLoading, vaultSafetyWarning,
    maxWithdrawUsd, explorerUrl,
    handleDeposit, handleWithdrawAll, handleWithdrawAmount,
  } = useVaultPosition({
    selectedVaultAddress, assetDecimals, assetSymbol,
    assetAddress, assetPriceUsd, sharePriceUsd,
  });

  const isAuthed = authenticated && !!address && isReady;
  const [vaultTab, setVaultTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => { setReviewMode(false); }, [vaultTab, selectedVaultAddress]);

  const vaultPositionUsd = maxWithdrawUsd !== null ? maxWithdrawUsd.toFixed(2) : null;
  const walletBalanceUsd = assetBalance !== null && assetPriceUsd
    ? (parseFloat(formatTokenAmount(assetBalance, assetDecimals)) * assetPriceUsd).toFixed(2)
    : null;

  // Validation
  const depositValidation = useMemo(() => validateDepositAction({
    depositAmount, assetDecimals,
    assetBalance, isConnected: isAuthed, assetSymbol,
  }), [depositAmount, assetDecimals, assetBalance, isAuthed, assetSymbol]);

  const withdrawValidation = useMemo(() => validateWithdrawAction({
    withdrawAmount, shares,
    maxWithdrawUsd: maxWithdrawUsd ?? 0, isConnected: isAuthed,
  }), [withdrawAmount, shares, maxWithdrawUsd, isAuthed]);

  // Vault simulation
  const vaultSim = useMemo(() => {
    if (!shares || !sharePriceUsd || !assetPriceUsd) return null;
    if (vaultTab === 'deposit') {
      const depositParsed = (() => {
        if (!depositAmount || parseFloat(depositAmount) <= 0) return 0n;
        try { return parseTokenAmount(depositAmount, assetDecimals); } catch { return 0n; }
      })();
      return simulateVaultDeposit(shares, sharePriceUsd, depositParsed, assetPriceUsd, assetDecimals);
    } else {
      const withdrawUsd = parseFloat(withdrawAmount) || 0;
      return simulateVaultWithdraw(shares, sharePriceUsd, withdrawUsd);
    }
  }, [vaultTab, shares, sharePriceUsd, assetPriceUsd, depositAmount, withdrawAmount, assetDecimals]);

  const activeValidation = vaultTab === 'deposit' ? depositValidation : withdrawValidation;
  const canExecute = activeValidation.isValid && !isLoading && !!selectedVaultAddress;

  const ctaLabel = vaultTab === 'deposit'
    ? (depositAmount && parseFloat(depositAmount) > 0 ? `Deposit ${assetSymbol}` : 'Enter amount')
    : (withdrawAmount && parseFloat(withdrawAmount) > 0 ? 'Withdraw' : 'Enter amount');

  const handleCtaClick = () => {
    if (!canExecute) return;
    setReviewMode(true);
  };

  const handleConfirm = async () => {
    if (vaultTab === 'deposit') {
      await handleDeposit();
    } else {
      await handleWithdrawAmount();
    }
    setReviewMode(false);
  };

  const actionSummary = vaultTab === 'deposit'
    ? `Deposit ${depositAmount} ${assetSymbol} into vault`
    : `Withdraw $${withdrawAmount} from vault`;

  return (
    <div className="surface-card w-full p-5 h-full overflow-y-auto">
      <div className="space-y-5">
        <div>
          <h3 className="text-label mb-1">Vault Operations</h3>
          {selectedVault && (
            <p className="text-sm font-medium text-foreground">
              {selectedVault.name}
              <span className="text-muted-foreground ml-2 text-xs">({assetSymbol})</span>
            </p>
          )}
          {selectedVault && selectedVault.netApy != null && (
            <p className="text-xs text-accent mt-1 font-mono">
              {formatPercent(selectedVault.netApy)} APY
            </p>
          )}
          {isAuthed && (
            <p className="text-xs text-muted-foreground font-mono break-all select-all mt-1">{address}</p>
          )}
        </div>

        {!isAuthed ? (
          <div className="space-y-4">
            <div className="surface-elevated p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Asset</span>
                <span className="font-medium text-foreground">{assetSymbol}</span>
              </div>
              {selectedVault?.totalAssetsUsd != null && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">TVL</span>
                  <span className="font-medium text-foreground font-mono">
                    {formatUsd(selectedVault.totalAssetsUsd)}
                  </span>
                </div>
              )}
            </div>
            <Button variant="default" size="lg" className="w-full" onClick={login}>
              Connect Wallet
            </Button>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Connect your wallet to deposit or withdraw
            </p>
          </div>
        ) : reviewMode ? (
          /* Review Step */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReviewMode(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                disabled={isLoading}
              >
                &larr; Back
              </button>
              <h4 className="text-sm font-medium text-foreground">Review Transaction</h4>
            </div>

            <div className="surface-elevated p-3 rounded-md">
              <p className="text-xs text-foreground font-medium">{actionSummary}</p>
            </div>

            {vaultSim && vaultSim.hasInput && (
              <div className="surface-elevated p-4 space-y-2 text-xs">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">Position Impact</p>
                <ValueTransition
                  label="Position Value"
                  currentValue={`$${vaultSim.currentUsdValue.toFixed(2)}`}
                  projectedValue={vaultSim.projectedUsdValue !== null ? `$${vaultSim.projectedUsdValue.toFixed(2)}` : null}
                  currentColor="text-foreground"
                  projectedColor="text-foreground"
                />
                <ValueTransition
                  label="Vault Shares"
                  currentValue={formatVaultShares(vaultSim.currentShares)}
                  projectedValue={vaultSim.projectedShares !== null ? formatVaultShares(vaultSim.projectedShares) : null}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setReviewMode(false)} disabled={isLoading}>
                Back
              </Button>
              <Button variant="accent" size="sm" className="flex-1" onClick={handleConfirm} disabled={isLoading}>
                {isLoading ? (
                  <Spinner />
                ) : 'Confirm'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-1 bg-white/[0.05] rounded-lg p-1">
              <button
                className={`flex-1 text-sm transition-colors ${vaultTab === 'deposit' ? 'bg-white/[0.1] text-foreground font-medium rounded-md px-4 py-1.5' : 'text-muted-foreground px-4 py-1.5 hover:text-foreground'}`}
                onClick={() => setVaultTab('deposit')}
              >
                Deposit
              </button>
              <button
                className={`flex-1 text-sm transition-colors ${vaultTab === 'withdraw' ? 'bg-white/[0.1] text-foreground font-medium rounded-md px-4 py-1.5' : 'text-muted-foreground px-4 py-1.5 hover:text-foreground'}`}
                onClick={() => setVaultTab('withdraw')}
              >
                Withdraw
              </button>
            </div>

            <div className="surface-elevated p-4 space-y-2 text-xs">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">Your Position</p>
              {vaultSim ? (
                <>
                  <ValueTransition
                    label="Position Value"
                    currentValue={`$${vaultSim.currentUsdValue.toFixed(2)}`}
                    projectedValue={vaultSim.hasInput && vaultSim.projectedUsdValue !== null ? `$${vaultSim.projectedUsdValue.toFixed(2)}` : null}
                    currentColor="text-foreground"
                    projectedColor="text-foreground"
                  />
                  <ValueTransition
                    label="Vault Shares"
                    currentValue={formatVaultShares(vaultSim.currentShares)}
                    projectedValue={vaultSim.hasInput && vaultSim.projectedShares !== null ? formatVaultShares(vaultSim.projectedShares) : null}
                  />
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Position Value</span>
                    <span className="font-mono font-medium text-foreground">
                      {vaultPositionUsd ? `$${vaultPositionUsd}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Vault Shares</span>
                    <span className="font-mono font-medium text-foreground">
                      {shares !== null ? formatVaultShares(shares) : '—'}
                    </span>
                  </div>
                </>
              )}
              <div className="border-t border-white/[0.05] my-1" />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Wallet Balance</span>
                <span className="font-mono font-medium text-foreground">
                  {walletBalanceUsd ? `$${walletBalanceUsd}` : '—'}
                </span>
              </div>
              <div className="flex justify-end">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {assetBalance !== null ? `${formatTokenAmount(assetBalance, assetDecimals)} ${assetSymbol}` : '—'}
                </span>
              </div>
            </div>

            {vaultSafetyWarning && (
              <div className="surface-elevated border-destructive/30 rounded-md p-3">
                <p className="text-xs text-destructive">
                  <strong>Warning:</strong> {vaultSafetyWarning}
                </p>
              </div>
            )}

            {vaultTab === 'deposit' ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <label className="text-label block">Deposit {assetSymbol}</label>
                  {assetBalance !== null && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      Max: {formatTokenAmount(assetBalance, assetDecimals)} {assetSymbol}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 surface-elevated rounded-md px-3 py-2">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-transparent text-foreground font-mono text-sm outline-none"
                    />
                    <span className="text-xs text-muted-foreground">{assetSymbol}</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (assetBalance !== null) setDepositAmount(formatTokenAmount(assetBalance, assetDecimals));
                    }}
                    disabled={!assetBalance || assetBalance === 0n}
                  >
                    Max
                  </Button>
                </div>

                {selectedVault && selectedVault.netApy != null && (
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-muted-foreground">Estimated APY</span>
                    <span className="font-mono text-accent">{formatPercent(selectedVault.netApy)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label className="text-label block">Withdraw</label>
                  {maxWithdrawUsd !== null && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      Max: ${maxWithdrawUsd.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 surface-elevated rounded-md px-3 py-2">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Amount in USD"
                      className="flex-1 bg-transparent text-foreground font-mono text-xs outline-none min-w-0"
                    />
                    <span className="text-[10px] text-muted-foreground">USD</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (maxWithdrawUsd) setWithdrawAmount(maxWithdrawUsd.toFixed(2));
                    }}
                    disabled={!maxWithdrawUsd || maxWithdrawUsd <= 0}
                  >
                    Max
                  </Button>
                </div>
                {shares !== null && shares > 0n && (
                  <Button
                    variant="destructive"
                    size="xs"
                    className="w-full"
                    onClick={async () => { await handleWithdrawAll(); }}
                    disabled={isLoading || !shares || shares === 0n}
                  >
                    {isLoading ? '...' : 'Withdraw All Shares'}
                  </Button>
                )}
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
                ) : ctaLabel}
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
