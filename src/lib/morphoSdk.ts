'use client';

import {
  MorphoClient,
  isRequirementApproval,
  isRequirementAuthorization,
  isRequirementSignature,
  type ERC20ApprovalAction,
  type MorphoAuthorizationAction,
  type Requirement,
  type RequirementSignature,
  type Transaction,
} from '@morpho-org/morpho-sdk';
import type { Address, Chain, PublicClient, WalletClient } from 'viem';

type OnchainRequirement =
  | Readonly<Transaction<ERC20ApprovalAction>>
  | Readonly<Transaction<MorphoAuthorizationAction>>;

export type MorphoRequirement = OnchainRequirement | Requirement;

export function getWalletClientAddress(walletClient: WalletClient): Address {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');
  return (typeof account === 'string' ? account : account.address) as Address;
}

export function createMorphoClient(walletClient: WalletClient) {
  return new MorphoClient(walletClient, {
    supportSignature: true,
    metadata: { origin: 'ori-recipe' },
  });
}

export async function resolveRequirements(
  requirements: readonly MorphoRequirement[],
  walletClient: WalletClient,
  publicClient: PublicClient,
  userAddress: Address,
  chain: Chain,
): Promise<RequirementSignature | undefined> {
  let requirementSignature: RequirementSignature | undefined;
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  for (const requirement of requirements) {
    if (isRequirementApproval(requirement) || isRequirementAuthorization(requirement)) {
      const hash = await walletClient.sendTransaction({
        to: requirement.to,
        data: requirement.data,
        value: requirement.value,
        chain,
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      continue;
    }

    if (isRequirementSignature(requirement)) {
      requirementSignature = await requirement.sign(walletClient, userAddress);
    }
  }

  return requirementSignature;
}

export async function sendBuiltTx(
  walletClient: WalletClient,
  tx: Readonly<Transaction>,
  chain: Chain,
): Promise<`0x${string}`> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  return walletClient.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
    chain,
    account,
  });
}
