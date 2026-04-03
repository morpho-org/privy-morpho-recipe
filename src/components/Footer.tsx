export default function Footer() {
  return (
    <footer className="border-t border-white/[0.05] mt-20">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-muted-foreground/40 text-xs">
          Educational demo — Exercise caution with real funds.
        </p>
        <div className="flex gap-4">
          <a
            href="https://docs.privy.io/basics/get-started/about"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/40 hover:text-muted-foreground text-xs transition-colors"
          >
            Privy Docs
          </a>
          <a
            href="https://docs.morpho.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/40 hover:text-muted-foreground text-xs transition-colors"
          >
            Morpho Docs
          </a>
        </div>
      </div>
    </footer>
  );
}
