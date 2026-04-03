'use client';

import { motion } from 'framer-motion';
import type { useMarkets } from '@/hooks/useMarkets';
import { useChain } from '@/context/ChainContext';
import { formatUsd, formatPercent, formatTokenAmount } from '@/lib/utils';
import TableSkeleton from './ui/TableSkeleton';

interface MarketTableProps {
  markets: ReturnType<typeof useMarkets>['markets'];
  onSelect: (marketKey: string) => void;
  selectedKey?: string | null;
  loading?: boolean;
  error?: { message: string } | null;
}

export default function MarketTable({ markets, onSelect, selectedKey, loading, error }: MarketTableProps) {
  const compact = !!selectedKey;
  const { selectedChain } = useChain();

  if (error) {
    return (
      <div className="surface-card p-8 text-center">
        <p className="text-sm text-destructive">Failed to load markets: {error.message}</p>
      </div>
    );
  }

  const cellText = compact ? 'text-xs' : 'text-sm';
  const headerPadding = compact ? 'px-3 py-2 text-xs' : 'px-5 py-3 text-label';
  const cellPadding = compact ? 'px-3 py-2' : 'px-5 py-3.5';

  const headers = (
    <div className={`grid ${compact ? 'gap-3' : 'gap-4'} ${headerPadding} border-b border-white/[0.05]`} style={{ gridTemplateColumns: '0.7fr 1fr 0.7fr 0.7fr 1fr 0.8fr 0.8fr 1fr' }}>
      <span>Network</span>
      <span>Collateral</span>
      <span>Loan</span>
      <span className="text-right">LLTV</span>
      <span className="text-right">Market Size</span>
      <span className="text-right">6H Rate</span>
      <span className="text-right">Utilization</span>
      <span className="text-right">Liquidity</span>
    </div>
  );

  if (loading && markets.length === 0) {
    return <TableSkeleton columns={8} headers={headers} />;
  }

  if (markets.length === 0) {
    return (
      <div className="surface-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No markets found for this filter.</p>
      </div>
    );
  }

  return (
    <div className="surface-card overflow-hidden">
      {headers}

      {markets.map((m, i) => {
        const isSelected = selectedKey === m.uniqueKey;
        const lltvPercent = (Number(BigInt(m.lltv)) / 1e16).toFixed(2) + '%';

        return (
          <motion.button
            key={m.uniqueKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.6) }}
            onClick={() => onSelect(m.uniqueKey)}
            style={{ gridTemplateColumns: '0.7fr 1fr 0.7fr 0.7fr 1fr 0.8fr 0.8fr 1fr' }}
            className={`grid ${compact ? 'gap-3' : 'gap-4'} ${cellPadding} w-full text-left hover-lift hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-b-0 ${
              isSelected ? 'bg-accent/10 border-l-2 border-l-accent' : ''
            }`}
          >
            <span className={`${cellText} text-muted-foreground truncate`}>{selectedChain.name}</span>
            <span className={`${cellText} font-medium text-foreground truncate`}>{m.collateralAsset?.symbol ?? '-'}</span>
            <span className={`${cellText} text-muted-foreground truncate`}>{m.loanAsset.symbol}</span>
            <span className={`${cellText} font-mono text-muted-foreground text-right truncate`}>{lltvPercent}</span>
            <span className={`${cellText} font-mono text-muted-foreground text-right truncate`}>
              {formatUsd(
                (m.state?.supplyAssetsUsd ?? 0) +
                Number(formatTokenAmount(BigInt(m.reallocatableLiquidityAssets ?? '0'), m.loanAsset.decimals)) *
                (m.loanAsset.priceUsd ?? 0)
              )}
            </span>
            <span className={`${cellText} font-mono text-accent text-right truncate`}>
              {formatPercent(m.state?.avgBorrowApy)}
            </span>
            <span className={`${cellText} font-mono text-muted-foreground text-right truncate`}>
              {formatPercent(m.state?.utilization)}
            </span>
            <span className={`${cellText} font-mono text-muted-foreground text-right truncate`}>
              {formatUsd(m.state?.totalLiquidityUsd)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
