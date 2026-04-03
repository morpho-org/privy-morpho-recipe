import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob: https://cdn.morpho.org https://api.web3modal.org",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self' https://api.morpho.org https://*.pimlico.io https://*.privy.io wss://*.privy.io https://*.privy.systems https://*.infura.io https://*.alchemy.com https://*.publicnode.com https://*.drpc.org https://mainnet.base.org https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org https://api.web3modal.org",
            "frame-src 'self' https://*.privy.io https://*.privy.systems",
          ].join('; '),
        },
      ],
    }];
  },
};

export default nextConfig;
