'use client';

import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

let client: ApolloClient | null = null;

export function getApolloClient() {
  if (client) return client;

  client = new ApolloClient({
    link: new HttpLink({
      uri: process.env.NEXT_PUBLIC_MORPHO_API_URL || 'https://api.morpho.org/graphql',
    }),
    cache: new InMemoryCache({
      typePolicies: {
        Market: { keyFields: ['uniqueKey'] },
        VaultV2: { keyFields: ['address'] },
        Chain: { keyFields: ['id'] },
        Query: {
          fields: {
            markets: { keyArgs: ['where'], merge: false },
            vaultV2s: { keyArgs: ['where'], merge: false },
            chains: { merge: false },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
        nextFetchPolicy: 'cache-first',
      },
    },
  });

  return client;
}
