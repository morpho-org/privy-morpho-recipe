import React from 'react';
import { ChainProvider } from '@/context/ChainContext';
import { MockedProvider } from '@apollo/client/testing/react';

export function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <MockedProvider mocks={[]} >
      <ChainProvider>
        {children}
      </ChainProvider>
    </MockedProvider>
  );
}
