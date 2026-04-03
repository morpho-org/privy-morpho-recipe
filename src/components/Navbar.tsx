'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { ChevronDown } from 'lucide-react';
import { useChain } from '@/context/ChainContext';

const navLinks = [
  { href: '/earn', label: 'Earn' },
  { href: '/borrow', label: 'Borrow' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { ready, authenticated, login, logout } = usePrivy();
  const { selectedChain, supportedChains, setSelectedChain, isLoadingChains } = useChain();

  const isLanding = pathname === '/';

  return (
    <nav className="h-14 border-b border-white/[0.05] flex items-center justify-between px-6 sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-4 w-4 bg-foreground rounded-sm" />
          <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-foreground">
            Privy &times; Morpho
          </span>
        </Link>
      </div>

      {!isLanding && (
        <div className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                pathname === link.href || pathname.startsWith(link.href + '/')
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        {!isLanding && (
          <div className="flex items-center gap-1.5 surface-elevated border border-white/[0.1] px-4 py-2 rounded-md">
            <select
              value={selectedChain.id}
              onChange={(e) => {
                const chain = supportedChains.find((c) => c.id === Number(e.target.value));
                if (chain) setSelectedChain(chain);
              }}
              disabled={isLoadingChains}
              aria-label="Select chain"
              className="bg-transparent text-xs text-foreground outline-none cursor-pointer appearance-none pr-4"
            >
              {supportedChains.map((chain) => (
                <option key={chain.id} value={chain.id} className="bg-card text-foreground">
                  {chain.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} strokeWidth={1.5} className="text-muted-foreground -ml-3 pointer-events-none" />
          </div>
        )}
        {!isLanding && ready && (
          <button
            onClick={authenticated ? logout : login}
            className={`h-9 px-5 text-sm font-medium rounded-md transition-all duration-150 active:scale-[0.98] ${
              authenticated
                ? 'surface-card text-foreground hover:bg-secondary'
                : 'bg-foreground text-background hover:bg-foreground/90'
            }`}
          >
            {authenticated ? 'Disconnect' : 'Connect'}
          </button>
        )}
      </div>
    </nav>
  );
}
