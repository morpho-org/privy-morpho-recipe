import { vi } from 'vitest';

export const mockSendTransaction = vi.fn().mockResolvedValue('0xmocktxhash');

export const mockWalletClient = {
  account: { address: '0x1234567890abcdef1234567890abcdef12345678' as const },
  sendTransaction: mockSendTransaction,
};

export const mockPublicClient = {
  readContract: vi.fn().mockResolvedValue(0n),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
};

vi.mock('wagmi', () => ({
  useWalletClient: vi.fn(() => ({ data: null })),
  createConfig: vi.fn(),
  WagmiProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/usePublicClient', () => ({
  usePublicClient: vi.fn(() => mockPublicClient),
}));
