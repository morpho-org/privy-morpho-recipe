import { graphql, HttpResponse } from 'msw';
import { chainsFixture } from '../fixtures/chains';
import { vaultsFixture } from '../fixtures/vaults';
import { marketsFixture } from '../fixtures/markets';

export const handlers = [
  graphql.query('GetChains', () => {
    return HttpResponse.json({
      data: { chains: chainsFixture },
    });
  }),

  graphql.query('GetVaults', () => {
    return HttpResponse.json({
      data: { vaultV2s: { items: vaultsFixture } },
    });
  }),

  graphql.query('GetMarkets', () => {
    return HttpResponse.json({
      data: { markets: { items: marketsFixture } },
    });
  }),
];
