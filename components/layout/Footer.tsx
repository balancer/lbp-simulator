import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 py-8 mt-20">
      <div className="w-full container mx-auto max-w-7xl px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">
            Beets
          </span>
        </div>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link href="https://docs.beets.fi/" className="hover:text-foreground">
            Docs
          </Link>
          <Link href="https://x.com/beets_fi" className="hover:text-foreground">
            Twitter
          </Link>
          <Link href="https://beets.fi/discord" className="hover:text-foreground">
            Discord
          </Link>
          <Link href="https://github.com/beethovenxfi/" className="hover:text-foreground">
            GitHub
          </Link>
        </nav>
      </div>
    </footer>
  );
}
