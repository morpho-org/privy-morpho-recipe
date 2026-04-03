'use client';

import { type SimulationResult } from '@/lib/simulate';
import { type TxStep } from '@/hooks/useMarketPosition';
import { SimulationSummary } from './SimulationSummary';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';

interface ReviewStepProps {
  actionSummary: string;
  simulation: SimulationResult | null;
  txSteps: TxStep[];
  lltvPercent: string;
  borrowApy?: string;
  collateralSymbol: string;
  loanSymbol: string;
  marketLltv: bigint;
  isLoading: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function ReviewStep({
  actionSummary,
  simulation,
  txSteps,
  lltvPercent,
  borrowApy,
  collateralSymbol,
  loanSymbol,
  marketLltv,
  isLoading,
  onConfirm,
  onBack,
}: ReviewStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
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

      {simulation && (
        <SimulationSummary
          simulation={simulation}
          lltvPercent={lltvPercent}
          borrowApy={borrowApy}
          collateralSymbol={collateralSymbol}
          loanSymbol={loanSymbol}
          marketLltv={marketLltv}
        />
      )}

      {txSteps.length > 0 && (
        <div className="surface-elevated rounded-md p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Transaction Steps</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            {txSteps.map((step, i) => (
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

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={onBack}
          disabled={isLoading}
        >
          Back
        </Button>
        <Button
          variant="accent"
          size="sm"
          className="flex-1"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? (
            <Spinner />
          ) : (
            'Confirm'
          )}
        </Button>
      </div>
    </div>
  );
}
