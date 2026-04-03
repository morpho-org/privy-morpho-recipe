import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMarkets } from '@/hooks/useMarkets';
import { TestProviders } from '../mocks/TestProviders';
import { marketsFixture } from '../fixtures/markets';
import { MockedProvider } from '@apollo/client/testing/react';
import { GetMarketsDocument } from '@/graphql/__generated__/graphql';
import React from 'react';

// Mock ChainContext to provide a stable chain
vi.mock('@/context/ChainContext', () => ({
  useChain: vi.fn(() => ({
    selectedChain: { id: 8453, name: 'Base' },
    supportedChains: [{ id: 8453, name: 'Base' }],
    setSelectedChain: vi.fn(),
    isLoadingChains: false,
  })),
  ChainProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mocks = [
  {
    request: {
      query: GetMarketsDocument,
      variables: { chainId: 8453, listed: true, isIdle: false },
    },
    result: {
      data: { markets: { items: marketsFixture } },
    },
  },
];

function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(MockedProvider, { mocks,  }, children);
}

describe('useMarkets', () => {
  it('returns markets filtered by collateralAsset', async () => {
    const { result } = renderHook(() => useMarkets(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // marketsFixture has 3 items, one with collateralAsset: null
    expect(result.current.markets).toHaveLength(2);
    expect(result.current.markets.every((m) => m.collateralAsset !== null)).toBe(true);
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useMarkets(), { wrapper: Wrapper });
    expect(result.current.loading).toBe(true);
  });

  it('selectedMarket is undefined initially', async () => {
    const { result } = renderHook(() => useMarkets(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.selectedMarket).toBeUndefined();
  });

  it('setSelectedMarketKey selects correct market', async () => {
    const { result } = renderHook(() => useMarkets(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedMarketKey(marketsFixture[0].uniqueKey));

    expect(result.current.selectedMarket?.uniqueKey).toBe(marketsFixture[0].uniqueKey);
    expect(result.current.loanSymbol).toBe('USDC');
    expect(result.current.collateralSymbol).toBe('cbBTC');
  });

  it('computes lltvPercent correctly', async () => {
    const { result } = renderHook(() => useMarkets(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedMarketKey(marketsFixture[0].uniqueKey));

    // 860000000000000000 / 1e16 = 86
    expect(result.current.lltvPercent).toBe('86');
  });

  it('computes marketParamsArg when market selected', async () => {
    const { result } = renderHook(() => useMarkets(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedMarketKey(marketsFixture[0].uniqueKey));

    expect(result.current.marketParamsArg).not.toBeNull();
    expect(result.current.marketParamsArg!.lltv).toBe(BigInt(marketsFixture[0].lltv));
  });

  it('handles error state', async () => {
    const errorMocks = [
      {
        request: {
          query: GetMarketsDocument,
          variables: { chainId: 8453, listed: true, isIdle: false },
        },
        error: new Error('GraphQL error'),
      },
    ];

    function ErrorWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(MockedProvider, { mocks: errorMocks,  }, children);
    }

    const { result } = renderHook(() => useMarkets(), { wrapper: ErrorWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
  });
});
