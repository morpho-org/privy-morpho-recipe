'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { useChain } from '@/context/ChainContext';
import { GetMarketsDocument } from '@/graphql/__generated__/graphql';

export function useMarkets() {
  const { selectedChain } = useChain();
  const [selectedMarketKey, setSelectedMarketKey] = useState<string>('');

  const { data: marketsData, loading, error } = useQuery(GetMarketsDocument, {
    variables: { chainId: selectedChain.id, listed: true, isIdle: false },
  });

  const markets = useMemo(() => {
    const items = marketsData?.markets?.items;
    if (!items) return [];
    return items.filter((m) => m.collateralAsset !== null);
  }, [marketsData]);


  const selectedMarket = useMemo(
    () => markets.find((m) => m.uniqueKey === selectedMarketKey),
    [markets, selectedMarketKey]
  );
  const loanDecimals = selectedMarket?.loanAsset.decimals ?? 6;
  const collateralDecimals = selectedMarket?.collateralAsset?.decimals ?? 18;
  const loanSymbol = selectedMarket?.loanAsset.symbol ?? 'Loan';
  const collateralSymbol = selectedMarket?.collateralAsset?.symbol ?? 'Collateral';
  const loanToken = selectedMarket?.loanAsset.address as `0x${string}` | undefined;
  const collateralToken = selectedMarket?.collateralAsset?.address as `0x${string}` | undefined;
  const oracleAddress = selectedMarket?.oracleAddress as `0x${string}` | undefined;
  const marketId = selectedMarketKey as `0x${string}`;

  const marketLltv = useMemo(
    () => selectedMarket ? BigInt(selectedMarket.lltv) : 0n,
    [selectedMarket]
  );

  const marketParamsArg = useMemo(
    () =>
      selectedMarket
        ? {
            loanToken: selectedMarket.loanAsset.address as `0x${string}`,
            collateralToken: selectedMarket.collateralAsset!.address as `0x${string}`,
            oracle: selectedMarket.oracleAddress as `0x${string}`,
            irm: selectedMarket.irmAddress as `0x${string}`,
            lltv: BigInt(selectedMarket.lltv),
          }
        : null,
    [selectedMarket]
  );

  const lltvPercent = useMemo(() => selectedMarket
    ? (Number(BigInt(selectedMarket.lltv)) / 1e16).toFixed(0)
    : '0', [selectedMarket]);

  return {
    markets,
    loading,
    error,
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
  };
}
