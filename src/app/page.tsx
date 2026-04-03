'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Layers, Fuel, Mail, ArrowLeftRight, Activity } from 'lucide-react';
import ProtocolStack from '../components/ProtocolStack';

const features = [
  {
    icon: Layers,
    title: 'Batch Transactions',
    description: 'Approve + Supply + Borrow in 1 click. Smart wallets combine multiple operations into a single atomic transaction.',
  },
  {
    icon: Fuel,
    title: 'Gas Sponsorship',
    description: 'Users never need ETH for gas. Paymaster-sponsored transactions remove the biggest onboarding barrier.',
  },
  {
    icon: Mail,
    title: 'Embedded Wallets',
    description: 'Email login to DeFi lending in 30 seconds. No seed phrases, no extensions, no friction.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Earn + Borrow',
    description: 'Full Morpho protocol coverage. Vault deposits for yield, Markets for collateralized borrowing.',
  },
  {
    icon: Activity,
    title: 'Health Monitoring',
    description: 'Server-side position monitoring with Privy server wallets. Track health factors and alert users before liquidation — 24/7 automated risk management.',
  },
];

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 md:py-20">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="grid md:grid-cols-2 gap-16 items-start"
      >
        <div className="max-w-md">
          <h1 className="text-4xl md:text-5xl font-medium tracking-tighter leading-[1.1] mb-6">
            Secure Liquidity.
            <br />
            <span className="text-muted-foreground">Optimized Yield.</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8 max-w-sm">
            A high-performance recipe combining Privy&apos;s secure wallet infrastructure with
            Morpho&apos;s hyper-efficient lending markets.
          </p>
          <div className="flex gap-3">
            <Link
              href="/earn"
              className="h-12 px-8 bg-foreground text-background font-medium rounded-md hover:bg-foreground/90 transition-all duration-150 active:scale-[0.98] inline-flex items-center"
            >
              Test Earn Product
            </Link>
            <Link
              href="/borrow"
              className="h-12 px-8 border border-white/[0.08] bg-transparent hover:bg-white/[0.05] text-foreground font-medium rounded-md transition-all duration-150 active:scale-[0.98] inline-flex items-center"
            >
              Test Borrow Product
            </Link>
          </div>
        </div>
        <ProtocolStack />
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-20"
      >
        <h2 className="text-label mb-2">What You Can Build</h2>
        <p className="text-xs text-muted-foreground mb-6">This recipe gives you the foundation to implement these features.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              className="surface-card p-5 hover-lift group"
            >
              <div className="flex items-start gap-3">
                <feature.icon className="text-muted-foreground mt-0.5 shrink-0" size={16} strokeWidth={1.5} />
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
