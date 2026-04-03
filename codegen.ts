import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'https://api.morpho.org/graphql',
  documents: ['src/graphql/**/*.ts'],
  generates: {
    './src/graphql/__generated__/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        scalars: {
          BigInt: 'string',
        },
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
