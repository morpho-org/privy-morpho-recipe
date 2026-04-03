/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query GetChains {\n    chains {\n      id\n      network\n      headBlock {\n        number\n      }\n    }\n  }\n": typeof types.GetChainsDocument,
    "\n  query GetVaults($chainId: [Int!]!) {\n    vaultV2s(\n      where: { chainId_in: $chainId }\n      first: 20\n      orderBy: TotalAssetsUsd\n      orderDirection: Desc\n    ) {\n      items {\n        address\n        name\n        symbol\n        sharePrice\n        totalAssets\n        netApy\n        totalAssetsUsd\n        liquidityUsd\n        performanceFee\n        managementFee\n        rewards {\n          asset {\n            symbol\n          }\n          supplyApr\n        }\n        curators {\n          items {\n            name\n            image\n          }\n        }\n        asset {\n          address\n          priceUsd\n          symbol\n          decimals\n        }\n      }\n    }\n  }\n": typeof types.GetVaultsDocument,
    "\n  query GetMarkets($chainId: Int!, $listed: Boolean!, $isIdle: Boolean) {\n    markets(\n      first: 50\n      orderBy: SizeUsd\n      orderDirection: Desc\n      where: { chainId_in: [$chainId], listed: $listed, isIdle: $isIdle }\n    ) {\n      items {\n        uniqueKey\n        lltv\n        listed\n        irmAddress\n        oracleAddress\n        reallocatableLiquidityAssets\n        loanAsset {\n          address\n          symbol\n          decimals\n          priceUsd\n        }\n        collateralAsset {\n          address\n          symbol\n          decimals\n        }\n        state {\n          borrowAssets\n          supplyAssets\n          supplyAssetsUsd\n          borrowAssetsUsd\n          collateralAssetsUsd\n          fee\n          utilization\n          supplyApy\n          netSupplyApy\n          borrowApy\n          netBorrowApy\n          avgBorrowApy\n          totalLiquidityUsd\n        }\n      }\n    }\n  }\n": typeof types.GetMarketsDocument,
};
const documents: Documents = {
    "\n  query GetChains {\n    chains {\n      id\n      network\n      headBlock {\n        number\n      }\n    }\n  }\n": types.GetChainsDocument,
    "\n  query GetVaults($chainId: [Int!]!) {\n    vaultV2s(\n      where: { chainId_in: $chainId }\n      first: 20\n      orderBy: TotalAssetsUsd\n      orderDirection: Desc\n    ) {\n      items {\n        address\n        name\n        symbol\n        sharePrice\n        totalAssets\n        netApy\n        totalAssetsUsd\n        liquidityUsd\n        performanceFee\n        managementFee\n        rewards {\n          asset {\n            symbol\n          }\n          supplyApr\n        }\n        curators {\n          items {\n            name\n            image\n          }\n        }\n        asset {\n          address\n          priceUsd\n          symbol\n          decimals\n        }\n      }\n    }\n  }\n": types.GetVaultsDocument,
    "\n  query GetMarkets($chainId: Int!, $listed: Boolean!, $isIdle: Boolean) {\n    markets(\n      first: 50\n      orderBy: SizeUsd\n      orderDirection: Desc\n      where: { chainId_in: [$chainId], listed: $listed, isIdle: $isIdle }\n    ) {\n      items {\n        uniqueKey\n        lltv\n        listed\n        irmAddress\n        oracleAddress\n        reallocatableLiquidityAssets\n        loanAsset {\n          address\n          symbol\n          decimals\n          priceUsd\n        }\n        collateralAsset {\n          address\n          symbol\n          decimals\n        }\n        state {\n          borrowAssets\n          supplyAssets\n          supplyAssetsUsd\n          borrowAssetsUsd\n          collateralAssetsUsd\n          fee\n          utilization\n          supplyApy\n          netSupplyApy\n          borrowApy\n          netBorrowApy\n          avgBorrowApy\n          totalLiquidityUsd\n        }\n      }\n    }\n  }\n": types.GetMarketsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetChains {\n    chains {\n      id\n      network\n      headBlock {\n        number\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetChains {\n    chains {\n      id\n      network\n      headBlock {\n        number\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetVaults($chainId: [Int!]!) {\n    vaultV2s(\n      where: { chainId_in: $chainId }\n      first: 20\n      orderBy: TotalAssetsUsd\n      orderDirection: Desc\n    ) {\n      items {\n        address\n        name\n        symbol\n        sharePrice\n        totalAssets\n        netApy\n        totalAssetsUsd\n        liquidityUsd\n        performanceFee\n        managementFee\n        rewards {\n          asset {\n            symbol\n          }\n          supplyApr\n        }\n        curators {\n          items {\n            name\n            image\n          }\n        }\n        asset {\n          address\n          priceUsd\n          symbol\n          decimals\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetVaults($chainId: [Int!]!) {\n    vaultV2s(\n      where: { chainId_in: $chainId }\n      first: 20\n      orderBy: TotalAssetsUsd\n      orderDirection: Desc\n    ) {\n      items {\n        address\n        name\n        symbol\n        sharePrice\n        totalAssets\n        netApy\n        totalAssetsUsd\n        liquidityUsd\n        performanceFee\n        managementFee\n        rewards {\n          asset {\n            symbol\n          }\n          supplyApr\n        }\n        curators {\n          items {\n            name\n            image\n          }\n        }\n        asset {\n          address\n          priceUsd\n          symbol\n          decimals\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetMarkets($chainId: Int!, $listed: Boolean!, $isIdle: Boolean) {\n    markets(\n      first: 50\n      orderBy: SizeUsd\n      orderDirection: Desc\n      where: { chainId_in: [$chainId], listed: $listed, isIdle: $isIdle }\n    ) {\n      items {\n        uniqueKey\n        lltv\n        listed\n        irmAddress\n        oracleAddress\n        reallocatableLiquidityAssets\n        loanAsset {\n          address\n          symbol\n          decimals\n          priceUsd\n        }\n        collateralAsset {\n          address\n          symbol\n          decimals\n        }\n        state {\n          borrowAssets\n          supplyAssets\n          supplyAssetsUsd\n          borrowAssetsUsd\n          collateralAssetsUsd\n          fee\n          utilization\n          supplyApy\n          netSupplyApy\n          borrowApy\n          netBorrowApy\n          avgBorrowApy\n          totalLiquidityUsd\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetMarkets($chainId: Int!, $listed: Boolean!, $isIdle: Boolean) {\n    markets(\n      first: 50\n      orderBy: SizeUsd\n      orderDirection: Desc\n      where: { chainId_in: [$chainId], listed: $listed, isIdle: $isIdle }\n    ) {\n      items {\n        uniqueKey\n        lltv\n        listed\n        irmAddress\n        oracleAddress\n        reallocatableLiquidityAssets\n        loanAsset {\n          address\n          symbol\n          decimals\n          priceUsd\n        }\n        collateralAsset {\n          address\n          symbol\n          decimals\n        }\n        state {\n          borrowAssets\n          supplyAssets\n          supplyAssetsUsd\n          borrowAssetsUsd\n          collateralAssetsUsd\n          fee\n          utilization\n          supplyApy\n          netSupplyApy\n          borrowApy\n          netBorrowApy\n          avgBorrowApy\n          totalLiquidityUsd\n        }\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;