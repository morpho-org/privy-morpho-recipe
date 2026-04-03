const MARKET_ID_RE = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function parseMarketParams(segments?: string[]): { chainId: number | null; marketId: string | null } {
  if (!segments || segments.length === 0) return { chainId: null, marketId: null };
  const chainId = Number(segments[0]);
  if (!Number.isFinite(chainId) || chainId <= 0) return { chainId: null, marketId: null };
  if (segments.length < 2 || !MARKET_ID_RE.test(segments[1])) return { chainId, marketId: null };
  return { chainId, marketId: segments[1] };
}

export function parseVaultParams(segments?: string[]): { chainId: number | null; vaultAddress: string | null } {
  if (!segments || segments.length === 0) return { chainId: null, vaultAddress: null };
  const chainId = Number(segments[0]);
  if (!Number.isFinite(chainId) || chainId <= 0) return { chainId: null, vaultAddress: null };
  if (segments.length < 2 || !ADDRESS_RE.test(segments[1])) return { chainId, vaultAddress: null };
  return { chainId, vaultAddress: segments[1] };
}
