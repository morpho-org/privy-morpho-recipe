'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { useChain } from '@/context/ChainContext';
import { GetVaultsDocument } from '@/graphql/__generated__/graphql';

export function useVaults() {
  const { selectedChain } = useChain();
  const [selectedVaultAddress, setSelectedVaultAddress] = useState<string>('');

  const { data: vaultsData, loading, error } = useQuery(GetVaultsDocument, {
    variables: { chainId: [selectedChain.id] },
  });

  const vaults = useMemo(() => {
    const items = vaultsData?.vaultV2s?.items;
    if (!items) return [];
    return items.filter((v) => v.name && v.name.trim() !== '');
  }, [vaultsData]);


  const selectedVault = useMemo(
    () => vaults.find((v) => v.address === selectedVaultAddress),
    [vaults, selectedVaultAddress]
  );

  const sharePriceUsd = selectedVault?.sharePrice ?? null;
  const assetPriceUsd = selectedVault?.asset.priceUsd ?? null;
  const assetDecimals = selectedVault?.asset.decimals ?? 6;
  const assetSymbol = selectedVault?.asset.symbol ?? 'Token';
  const assetAddress = selectedVault?.asset.address as `0x${string}` | undefined;

  return {
    vaults,
    loading,
    error,
    selectedVaultAddress,
    setSelectedVaultAddress,
    selectedVault,
    assetDecimals,
    assetSymbol,
    assetAddress,
    sharePriceUsd,
    assetPriceUsd,
  };
}
