'use client';

import { motion } from 'framer-motion';
import { Shield, Zap, ArrowDown } from 'lucide-react';

const layers = [
  {
    label: 'WALLET',
    name: 'Privy',
    description: 'Embedded wallet infrastructure',
    icon: Shield,
    detail: 'Social login · Smart wallets · No seed phrases',
  },
  {
    label: 'EXECUTION',
    name: 'Recipe',
    description: 'Transaction orchestration layer',
    icon: Zap,
    detail: 'Approve · Supply · Borrow — Single signature',
    isMiddle: true,
  },
  {
    label: 'LIQUIDITY',
    name: 'Morpho',
    description: 'Universal lending protocol',
    icon: Zap,
    detail: 'Earn yield · Borrow assets · Non-custodial',
  },
];

export default function ProtocolStack() {
  return (
    <div>
      <span className="text-label mb-4 block">Protocol Stack</span>
      <div className="relative">
        {layers.map((layer, i) => (
          <div key={layer.name}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.15, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              className={`surface-card p-5 hover-lift group cursor-default ${
                layer.isMiddle ? 'border-accent/20 relative z-10 my-[-1px]' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-label">{layer.label}</span>
                  <h3 className="text-foreground font-medium text-lg tracking-tight">
                    {layer.name}
                  </h3>
                  <p className="text-muted-foreground text-sm">{layer.description}</p>
                </div>
                <layer.icon className="text-muted-foreground mt-1" size={18} strokeWidth={1.5} />
              </div>
              <div className="mt-3 pt-3 border-t border-white/[0.05]">
                <p className="text-muted-foreground text-xs font-mono">{layer.detail}</p>
              </div>
              {layer.isMiddle && (
                <div className="absolute inset-0 rounded-md bg-accent/[0.03] pointer-events-none" />
              )}
            </motion.div>
            {i < layers.length - 1 && (
              <div className="flex justify-center py-1.5">
                <ArrowDown size={14} strokeWidth={1.5} className="text-muted-foreground/50" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
