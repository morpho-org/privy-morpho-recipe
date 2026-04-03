import { describe, it, expect } from 'vitest';
import { parseMarketParams, parseVaultParams } from '@/lib/urlParams';

describe('parseMarketParams', () => {
  it('returns nulls for undefined segments', () => {
    expect(parseMarketParams(undefined)).toEqual({ chainId: null, marketId: null });
  });

  it('returns nulls for empty array', () => {
    expect(parseMarketParams([])).toEqual({ chainId: null, marketId: null });
  });

  it('parses valid chainId only', () => {
    expect(parseMarketParams(['8453'])).toEqual({ chainId: 8453, marketId: null });
  });

  it('parses valid chainId and marketId', () => {
    const marketId = '0x' + 'ab'.repeat(32);
    expect(parseMarketParams(['8453', marketId])).toEqual({
      chainId: 8453,
      marketId,
    });
  });

  it('returns null chainId for NaN', () => {
    expect(parseMarketParams(['notanumber'])).toEqual({ chainId: null, marketId: null });
  });

  it('returns null chainId for negative', () => {
    expect(parseMarketParams(['-1'])).toEqual({ chainId: null, marketId: null });
  });

  it('returns null chainId for Infinity', () => {
    expect(parseMarketParams(['Infinity'])).toEqual({ chainId: null, marketId: null });
  });

  it('rejects invalid marketId format (too short)', () => {
    expect(parseMarketParams(['8453', '0xabc'])).toEqual({ chainId: 8453, marketId: null });
  });

  it('rejects marketId without 0x prefix', () => {
    expect(parseMarketParams(['8453', 'ab'.repeat(32)])).toEqual({ chainId: 8453, marketId: null });
  });
});

describe('parseVaultParams', () => {
  it('returns nulls for undefined segments', () => {
    expect(parseVaultParams(undefined)).toEqual({ chainId: null, vaultAddress: null });
  });

  it('returns nulls for empty array', () => {
    expect(parseVaultParams([])).toEqual({ chainId: null, vaultAddress: null });
  });

  it('parses valid chainId only', () => {
    expect(parseVaultParams(['1'])).toEqual({ chainId: 1, vaultAddress: null });
  });

  it('parses valid chainId and address', () => {
    const addr = '0x' + 'ab'.repeat(20);
    expect(parseVaultParams(['8453', addr])).toEqual({
      chainId: 8453,
      vaultAddress: addr,
    });
  });

  it('rejects invalid address format (wrong length)', () => {
    expect(parseVaultParams(['8453', '0xabc'])).toEqual({ chainId: 8453, vaultAddress: null });
  });

  it('rejects address without 0x prefix', () => {
    expect(parseVaultParams(['8453', 'ab'.repeat(20)])).toEqual({ chainId: 8453, vaultAddress: null });
  });
});
