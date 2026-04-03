import { parseAbi } from 'viem';
import { blueAbi, metaMorphoAbi, blueOracleAbi } from '@morpho-org/blue-sdk-viem';

export const MORPHO_CORE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const;

export const MORPHO_CORE_ABI = blueAbi;
export const MORPHO_VAULT_ABI = metaMorphoAbi;
export const MORPHO_ORACLE_ABI = blueOracleAbi;

export const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
]);

export const ORACLE_PRICE_SCALE = 10n ** 36n;
export const VIRTUAL_SHARES = 10n ** 6n;
export const VIRTUAL_ASSETS = 1n;
export const WAD = 10n ** 18n;
export const VAULT_SHARES_DECIMALS = 18;
export const SLIPPAGE_TOLERANCE_BPS = 100n;
export const REPAY_APPROVAL_BUFFER_BPS = 50n;
export const INFINITE_HEALTH_FACTOR = WAD * 100n;
export const SIMULATE_ONLY_SENTINEL = 'simulate-only' as const;

export const BORROW_SAFETY_BUFFER = 950n; // 95% of max (5% buffer)
export const BORROW_SAFETY_DIVISOR = 1000n;

export const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-500/10 border border-green-500/20 text-green-400',
  error: 'bg-red-500/10 border border-red-500/20 text-red-400',
  processing: 'surface-elevated text-muted-foreground',
  info: 'surface-elevated text-muted-foreground',
  idle: 'surface-elevated text-muted-foreground',
};
