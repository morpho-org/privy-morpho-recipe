'use client';

import { type SimulationResult } from '@/lib/simulate';
import { getHealthColor } from '@/lib/morphoMath';
import { WAD } from '@/lib/constants';
import { ValueTransition } from './ui/ValueTransition';

interface SimulationSummaryProps {
  simulation: SimulationResult;
  lltvPercent: string;
  borrowApy?: string;
  collateralSymbol: string;
  loanSymbol: string;
  marketLltv: bigint;
}

export function SimulationSummary({
  simulation,
  lltvPercent,
  borrowApy,
  collateralSymbol,
  loanSymbol,
  marketLltv,
}: SimulationSummaryProps) {
  const { current, projected, exceedsLltv } = simulation;

  const getLtvColor = (ltv: bigint) => {
    if (ltv >= marketLltv) return 'text-destructive';
    if (ltv >= (marketLltv * 90n) / 100n) return 'text-orange-400';
    if (ltv >= (marketLltv * 75n) / 100n) return 'text-yellow-400';
    return 'text-foreground';
  };

  const hasDebt = current.borrowed > 0n;
  const hasCollateral = current.collateral > 0n;
  const projectedHasDebt = projected ? projected.borrowed > 0n : hasDebt;

  return (
    <div className="surface-elevated p-4 space-y-2 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Your Position</span>
        {exceedsLltv && (
          <span className="text-[10px] font-medium text-destructive">Liquidation risk</span>
        )}
      </div>

      <ValueTransition
        label={`${collateralSymbol} Collateral`}
        currentValue={current.collateralFormatted}
        projectedValue={projected?.collateralFormatted}
        suffix={` ${collateralSymbol}`}
      />

      <ValueTransition
        label={`${loanSymbol} Debt`}
        currentValue={current.borrowedFormatted}
        projectedValue={projected?.borrowedFormatted}
        suffix={` ${loanSymbol}`}
      />

      {(hasDebt || projectedHasDebt) && (
        <ValueTransition
          label="Health Factor"
          currentValue={hasDebt ? current.hfFormatted : '-'}
          projectedValue={projected ? (projectedHasDebt ? projected.hfFormatted : '-') : undefined}
          currentColor={hasDebt ? current.hfColor : 'text-muted-foreground'}
          projectedColor={projected ? (projectedHasDebt ? projected.hfColor : 'text-muted-foreground') : undefined}
        />
      )}

      {!hasDebt && hasCollateral && !projected && (
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Health Status</span>
          <span className="font-medium text-green-400">No debt</span>
        </div>
      )}

      {(hasDebt || projectedHasDebt) && (
        <ValueTransition
          label="LTV"
          currentValue={current.ltvPercent}
          projectedValue={projected?.ltvPercent}
          currentColor={getLtvColor(current.ltv)}
          projectedColor={projected ? getLtvColor(projected.ltv) : undefined}
          suffix="%"
        />
      )}

      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">LLTV</span>
        <span className="font-mono text-xs font-medium text-foreground">{lltvPercent}%</span>
      </div>

      {borrowApy && (
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Borrow Rate</span>
          <span className="font-mono text-xs font-medium text-foreground">{borrowApy}</span>
        </div>
      )}

      {(current.liqPrice > 0n || (projected && projected.liqPrice > 0n)) && (
        <ValueTransition
          label="Liquidation Price"
          currentValue={current.liqPriceFormatted}
          projectedValue={projected?.liqPriceFormatted}
          currentColor="text-orange-400"
          projectedColor="text-orange-400"
        />
      )}

      {exceedsLltv && (
        <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-[10px] text-destructive font-medium">
            This action would put your position at risk of liquidation. Reduce borrow amount or add more collateral.
          </p>
        </div>
      )}
    </div>
  );
}
