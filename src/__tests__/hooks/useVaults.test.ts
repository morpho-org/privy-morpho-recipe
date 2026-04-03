import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVaults } from '@/hooks/useVaults';
import { vaultsFixture } from '../fixtures/vaults';
import { MockedProvider } from '@apollo/client/testing/react';
import { GetVaultsDocument } from '@/graphql/__generated__/graphql';
import React from 'react';

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
      query: GetVaultsDocument,
      variables: { chainId: [8453] },
    },
    result: {
      data: { vaultV2s: { items: vaultsFixture } },
    },
  },
];

function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(MockedProvider, { mocks,  }, children);
}

describe('useVaults', () => {
  it('returns vaults filtered by non-empty name', async () => {
    const { result } = renderHook(() => useVaults(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // vaultsFixture has 3 items, one with empty name
    expect(result.current.vaults).toHaveLength(2);
    expect(result.current.vaults.every((v) => v.name && v.name.trim() !== '')).toBe(true);
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useVaults(), { wrapper: Wrapper });
    expect(result.current.loading).toBe(true);
  });

  it('selectedVault is undefined initially', async () => {
    const { result } = renderHook(() => useVaults(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.selectedVault).toBeUndefined();
  });

  it('setSelectedVaultAddress selects correct vault', async () => {
    const { result } = renderHook(() => useVaults(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedVaultAddress(vaultsFixture[0].address));

    expect(result.current.selectedVault?.address).toBe(vaultsFixture[0].address);
    expect(result.current.assetSymbol).toBe('USDC');
    expect(result.current.assetDecimals).toBe(6);
  });

  it('computes sharePriceUsd from selected vault', async () => {
    const { result } = renderHook(() => useVaults(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedVaultAddress(vaultsFixture[0].address));
    expect(result.current.sharePriceUsd).toBe(1.05);
  });

  it('handles error state', async () => {
    const errorMocks = [
      {
        request: {
          query: GetVaultsDocument,
          variables: { chainId: [8453] },
        },
        error: new Error('GraphQL error'),
      },
    ];

    function ErrorWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(MockedProvider, { mocks: errorMocks,  }, children);
    }

    const { result } = renderHook(() => useVaults(), { wrapper: ErrorWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
  });
});
