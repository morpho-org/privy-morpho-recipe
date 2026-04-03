'use client';

import { useMemo } from 'react';
import { createPublicClient, http, type Chain, type PublicClient } from 'viem';
import { base } from 'viem/chains';
import { useChain } from '@/context/ChainContext';

const clientCache = new Map<number, PublicClient>();

const RPC_OVERRIDES: Partial<Record<number, { url: string; isAlchemy: boolean }>> = {
  [base.id]: { url: '/api/rpc/base', isAlchemy: true },
};

function createOptimizedClient(chain: Chain): PublicClient {
  const override = RPC_OVERRIDES[chain.id];

  return createPublicClient({
    chain,
    transport: http(override?.url, {
      ...(override?.isAlchemy && {
        batch: {
          batchSize: 100,
          wait: 20,
        },
      }),
    }),
    batch: {
      multicall: {
        batchSize: 2048,
        wait: 50,
      },
    },
  });
}

export function usePublicClient() {
  const { selectedChain } = useChain();

  return useMemo(() => {
    const existing = clientCache.get(selectedChain.id);
    if (existing) return existing;
    const client = createOptimizedClient(selectedChain);
    clientCache.set(selectedChain.id, client);
    return client;
  }, [selectedChain]);
}
