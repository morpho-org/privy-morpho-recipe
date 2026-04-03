'use client';

import Navbar from './Navbar';
import Footer from './Footer';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background text-foreground selection:bg-accent/30">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
