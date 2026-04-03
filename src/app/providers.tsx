'use client';

import { ApolloProvider } from '@apollo/client/react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { http, createConfig } from 'wagmi';
import { mainnet, base, arbitrum, polygon, optimism, worldchain, unichain, ink } from 'viem/chains';
import { getApolloClient } from '@/lib/apolloClient';
import { ChainProvider } from '@/context/ChainContext';

const allChains = [mainnet, base, arbitrum, polygon, optimism, worldchain, unichain, ink] as const;

const wagmiConfig = createConfig({
  chains: allChains,
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [worldchain.id]: http(),
    [unichain.id]: http(),
    [ink.id]: http(),
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const apolloClient = useMemo(() => getApolloClient(), []);

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // During build/SSR without a valid app ID, render children without Privy
  if (!appId || appId === 'your-app-id-here') {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
        },
        defaultChain: base,
        supportedChains: [...allChains],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ApolloProvider client={apolloClient}>
          <WagmiProvider config={wagmiConfig}>
            <ChainProvider>
              {children}
            </ChainProvider>
          </WagmiProvider>
        </ApolloProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
