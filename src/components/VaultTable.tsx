'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { useVaults } from '@/hooks/useVaults';
import { useChain } from '@/context/ChainContext';
import { formatUsd, formatPercent } from '@/lib/utils';
import TableSkeleton from './ui/TableSkeleton';

interface VaultTableProps {
  vaults: ReturnType<typeof useVaults>['vaults'];
  onSelect: (address: string) => void;
  selectedAddress?: string | null;
  loading?: boolean;
  error?: { message: string } | null;
}

type Vault = ReturnType<typeof useVaults>['vaults'][number];

function ApyTooltip({ vault }: { vault: Vault }) {
  const rewards = vault.rewards ?? [];
  const rewardTotal = rewards.reduce((sum, r) => sum + (r.supplyApr ?? 0), 0);
  const baseApy = (vault.netApy ?? 0) - rewardTotal;

  return (
    <div className="absolute right-0 top-full mt-1 z-50 surface-elevated rounded-md p-3 shadow-lg min-w-[200px] text-xs space-y-1.5">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Base APY</span>
        <span className="font-mono text-foreground">{formatPercent(baseApy)}</span>
      </div>
      {rewards.map((r, i) => (
        <div key={i} className="flex justify-between">
          <span className="text-muted-foreground">+ {r.asset?.symbol ?? 'Reward'}</span>
          <span className="font-mono text-accent">{formatPercent(r.supplyApr)}</span>
        </div>
      ))}
      {vault.performanceFee != null && (
        <div className="flex justify-between border-t border-white/[0.05] pt-1.5">
          <span className="text-muted-foreground">Performance Fee</span>
          <span className="font-mono text-foreground">{formatPercent(vault.performanceFee)}</span>
        </div>
      )}
      {vault.managementFee != null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Management Fee</span>
          <span className="font-mono text-foreground">{formatPercent(vault.managementFee)}</span>
        </div>
      )}
    </div>
  );
}

function ApyCell({ vault }: { vault: Vault }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative text-right"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="text-sm font-mono text-accent cursor-help">
        {formatPercent(vault.netApy)}
      </span>
      {hovered && <ApyTooltip vault={vault} />}
    </div>
  );
}

export default function VaultTable({ vaults, onSelect, selectedAddress, loading, error }: VaultTableProps) {
  const compact = !!selectedAddress;
  const { selectedChain } = useChain();

  if (error) {
    return (
      <div className="surface-card p-8 text-center">
        <p className="text-sm text-destructive">Failed to load vaults: {error.message}</p>
      </div>
    );
  }

  const headers = (
    <div className={`grid ${compact ? 'gap-3 px-3 py-2 text-xs' : 'gap-4 px-5 py-3 text-label'} border-b border-white/[0.05]`} style={{ gridTemplateColumns: '0.7fr 1.5fr 1fr 1fr 1fr 0.7fr' }}>
      <span>Network</span>
      <span>Vault</span>
      <span className="text-right">Deposits</span>
      <span className="text-right">Liquidity</span>
      <span>Curator</span>
      <span className="text-right">APY</span>
    </div>
  );

  if (loading && vaults.length === 0) {
    return <TableSkeleton columns={6} headers={headers} />;
  }

  if (vaults.length === 0) {
    return (
      <div className="surface-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No vaults found.</p>
      </div>
    );
  }

  const cellText = compact ? 'text-xs' : 'text-sm';
  const cellPadding = compact ? 'px-3 py-2' : 'px-5 py-3.5';

  return (
    <div className="surface-card overflow-hidden">
      {headers}

      {vaults.map((v, i) => {
        const isSelected = selectedAddress === v.address;
        const curator = v.curators?.items?.[0];

        return (
          <motion.button
            key={v.address}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.6) }}
            onClick={() => onSelect(v.address)}
            style={{ gridTemplateColumns: '0.7fr 1.5fr 1fr 1fr 1fr 0.7fr' }}
            className={`grid ${compact ? 'gap-3' : 'gap-4'} ${cellPadding} w-full text-left hover-lift hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-b-0 ${
              isSelected ? 'bg-accent/10 border-l-2 border-l-accent' : ''
            }`}
          >
            <span className={`${cellText} text-muted-foreground truncate`}>{selectedChain.name}</span>
            <span className={`${cellText} font-medium text-foreground truncate`}>{v.name}</span>
            <span className={`${cellText} font-mono text-muted-foreground text-right truncate`}>
              {formatUsd(v.totalAssetsUsd)}
            </span>
            <span className={`${cellText} font-mono text-muted-foreground text-right truncate`}>
              {formatUsd(v.liquidityUsd)}
            </span>
            <div className={`${cellText} text-muted-foreground truncate flex items-center gap-1`}>
              {curator?.image && (
                <img src={curator.image} alt="" className="w-4 h-4 rounded-full shrink-0" />
              )}
              <span className="truncate">{curator?.name ?? '—'}</span>
            </div>
            <ApyCell vault={v} />
          </motion.button>
        );
      })}
    </div>
  );
}
