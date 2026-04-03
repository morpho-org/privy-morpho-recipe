'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@apollo/client/react';
import { type Chain } from 'viem';
import { mainnet, base, arbitrum, polygon, optimism, worldchain, unichain, ink } from 'viem/chains';
import { GetChainsDocument } from '@/graphql/__generated__/graphql';

const CHAIN_ID_MAP: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  137: polygon,
  10: optimism,
  480: worldchain,
  130: unichain,
  57073: ink,
};

interface ChainContextValue {
  selectedChain: Chain;
  supportedChains: Chain[];
  setSelectedChain: (chain: Chain) => void;
  isLoadingChains: boolean;
}

const ChainContext = createContext<ChainContextValue>({
  selectedChain: base,
  supportedChains: [base],
  setSelectedChain: () => {},
  isLoadingChains: true,
});

export function useChain() {
  return useContext(ChainContext);
}

export function ChainProvider({ children }: { children: ReactNode }) {
  const [selectedChain, setSelectedChain] = useState<Chain>(base);
  const [supportedChains, setSupportedChains] = useState<Chain[]>([base]);

  const { data, loading, error } = useQuery(GetChainsDocument, {
    fetchPolicy: 'cache-first',
    errorPolicy: 'all',
  });

  useEffect(() => {
    if (error) {
      console.error('Failed to fetch supported chains:', error);
    }
  }, [error]);

  useEffect(() => {
    if (!data?.chains) return;

    const chains: Chain[] = [];
    for (const item of data.chains) {
      if (item.headBlock === null) continue;
      const viemChain = CHAIN_ID_MAP[item.id];
      if (viemChain) chains.push(viemChain);
    }

    if (chains.length > 0) {
      setSupportedChains(chains);
      setSelectedChain((prev) => chains.some((c) => c.id === prev.id) ? prev : chains[0]);
    }
  }, [data]);

  return (
    <ChainContext.Provider value={{ selectedChain, supportedChains, setSelectedChain, isLoadingChains: loading }}>
      {children}
    </ChainContext.Provider>
  );
}
