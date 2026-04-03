'use client';

import { use, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import MarketTable from '@/components/MarketTable';
import { useMarkets } from '@/hooks/useMarkets';
import { useChain } from '@/context/ChainContext';
import { parseMarketParams } from '@/lib/urlParams';

const MarketOperationsModal = dynamic(() => import('@/components/MarketOperationsModal'), { ssr: false });

export default function BorrowPage({ params }: { params: Promise<{ params?: string[] }> }) {
  const { params: segments } = use(params);
  const { chainId: urlChainId, marketId: urlMarketId } = parseMarketParams(segments);

  const router = useRouter();
  const { selectedChain, supportedChains, setSelectedChain } = useChain();
  const { markets, loading, error } = useMarkets();

  const [selectedMarketKey, setSelectedMarketKey] = useState<string | null>(urlMarketId);

  // Sync chain from URL on initial load
  useEffect(() => {
    if (urlChainId && urlChainId !== selectedChain.id) {
      const chain = supportedChains.find((c) => c.id === urlChainId);
      if (chain) setSelectedChain(chain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync selection from URL changes (back/forward navigation)
  useEffect(() => {
    setSelectedMarketKey(urlMarketId);
  }, [urlMarketId]);

  const handleSelect = useCallback(
    (key: string) => {
      setSelectedMarketKey(key);
      router.push(`/borrow/${selectedChain.id}/${key}`, { scroll: false });
    },
    [router, selectedChain.id],
  );

  const handleClose = useCallback(() => {
    setSelectedMarketKey(null);
    router.push('/borrow', { scroll: false });
  }, [router]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 md:py-10">
      <div className="flex gap-6 items-start">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className={`${selectedMarketKey ? 'w-2/3' : 'w-full'} transition-all duration-300 space-y-5`}
        >
          <div className="flex items-end justify-between border-b border-white/[0.05] pb-4">
            <h2 className="text-label">Top 50 Available Morpho Markets</h2>
          </div>
          <MarketTable
            markets={markets}
            onSelect={handleSelect}
            selectedKey={selectedMarketKey}
            loading={loading}
            error={error ?? null}
          />
        </motion.div>

        <AnimatePresence>
          {selectedMarketKey && (
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              className="w-1/3 sticky top-20 max-h-[calc(100vh-6rem)] shrink-0 space-y-5"
            >
              <div className="flex items-end justify-between border-b border-white/[0.05] pb-4">
                <h2 className="text-label">Market Details</h2>
                <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors text-xs">
                  Close
                </button>
              </div>
              <MarketOperationsModal
                marketKey={selectedMarketKey}
              />
              <div className="flex justify-center pt-2">
                <img src="/morpho/PoweredbyMorpho-3-darkmode.svg" alt="Powered by Morpho" className="h-6 opacity-40" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
