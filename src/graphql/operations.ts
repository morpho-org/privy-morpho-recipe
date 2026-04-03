import { graphql } from './__generated__/gql';

export const GetChainsQuery = graphql(`
  query GetChains {
    chains {
      id
      network
      headBlock {
        number
      }
    }
  }
`);

export const GetVaultsQuery = graphql(`
  query GetVaults($chainId: [Int!]!) {
    vaultV2s(
      where: { chainId_in: $chainId }
      first: 20
      orderBy: TotalAssetsUsd
      orderDirection: Desc
    ) {
      items {
        address
        name
        symbol
        sharePrice
        totalAssets
        netApy
        totalAssetsUsd
        liquidityUsd
        performanceFee
        managementFee
        rewards {
          asset {
            symbol
          }
          supplyApr
        }
        curators {
          items {
            name
            image
          }
        }
        asset {
          address
          priceUsd
          symbol
          decimals
        }
      }
    }
  }
`);

export const GetMarketsQuery = graphql(`
  query GetMarkets($chainId: Int!, $listed: Boolean!, $isIdle: Boolean) {
    markets(
      first: 50
      orderBy: SizeUsd
      orderDirection: Desc
      where: { chainId_in: [$chainId], listed: $listed, isIdle: $isIdle }
    ) {
      items {
        uniqueKey
        lltv
        listed
        irmAddress
        oracleAddress
        reallocatableLiquidityAssets
        loanAsset {
          address
          symbol
          decimals
          priceUsd
        }
        collateralAsset {
          address
          symbol
          decimals
        }
        state {
          borrowAssets
          supplyAssets
          supplyAssetsUsd
          borrowAssetsUsd
          collateralAssetsUsd
          fee
          utilization
          supplyApy
          netSupplyApy
          borrowApy
          netBorrowApy
          avgBorrowApy
          totalLiquidityUsd
        }
      }
    }
  }
`);
