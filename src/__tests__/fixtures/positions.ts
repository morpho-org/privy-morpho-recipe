const WAD = 10n ** 18n;
const ORACLE_PRICE_SCALE = 10n ** 36n;

// A position with collateral and active debt
export const mockPositionWithDebt = {
  supplyShares: 0n,
  borrowShares: 100n * 10n ** 6n, // 100M borrow shares
  collateral: 1n * 10n ** 8n, // 1 cbBTC (8 decimals)
};

// A position with collateral only, no debt
export const mockPositionCollateralOnly = {
  supplyShares: 0n,
  borrowShares: 0n,
  collateral: 5n * 10n ** 17n, // 0.5 ETH (18 decimals)
};

// Market-level data for health factor computation
export const mockMarketData = {
  totalSupplyAssets: 1_000_000n * 10n ** 6n,
  totalSupplyShares: 1_000_000n * 10n ** 6n,
  totalBorrowAssets: 500_000n * 10n ** 6n,
  totalBorrowShares: 500_000n * 10n ** 6n,
  lastUpdate: 1700000000n,
  fee: 0n,
};

// Oracle price: 1 cbBTC = 60,000 USDC (scaled to 36 decimals for the oracle)
// price = 60000 * 10^36 * 10^6 / 10^8 = 60000 * 10^34
export const mockOraclePrice = 60000n * 10n ** 34n;

// LLTV at 86%
export const mockLltv = (86n * WAD) / 100n;
