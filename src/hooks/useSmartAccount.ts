'use client';

import { useCallback } from 'react';
import { useWalletClient, useAccount } from 'wagmi';
import { usePublicClient } from './usePublicClient';
import { useChain } from '@/context/ChainContext';

export interface Call {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
}

export function useSmartAccount() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { selectedChain } = useChain();

  const sendBatchTransaction = useCallback(
    async (calls: Call[]): Promise<{ hash: string; wasBatched: boolean }> => {
      if (!walletClient) throw new Error('Wallet not connected');
      const hashes: string[] = [];
      for (const call of calls) {
        const hash = await walletClient.sendTransaction({
          to: call.to,
          data: call.data,
          value: call.value ?? 0n,
          chain: selectedChain,
          account: walletClient.account,
        });
        hashes.push(hash);
        await publicClient.waitForTransactionReceipt({ hash });
      }
      return { hash: hashes[hashes.length - 1], wasBatched: false };
    },
    [walletClient, publicClient, selectedChain]
  );

  const sendSingleTransaction = useCallback(
    async (tx: Call): Promise<string> => {
      if (!walletClient) throw new Error('Wallet not connected');
      return walletClient.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ?? 0n,
        chain: selectedChain,
        account: walletClient.account,
      });
    },
    [walletClient, selectedChain]
  );

  return {
    sendBatchTransaction,
    sendSingleTransaction,
    isReady: !!walletClient,
    address,
  };
}
