export const chainsFixture = [
  {
    id: 8453,
    network: 'base',
    headBlock: { number: 12345678 },
  },
  {
    id: 1,
    network: 'ethereum',
    headBlock: { number: 99999999 },
  },
  {
    id: 42161,
    network: 'arbitrum',
    headBlock: null, // should be filtered out
  },
];
