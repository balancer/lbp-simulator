import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 py-8 mt-20">
      <div className="w-full container mx-auto max-w-7xl px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo-beets-white.svg"
            alt="Beets Logo"
            width={24}
            height={24}
          />
          <span className="text-sm font-semibold text-muted-foreground">
            Beets
          </span>
        </Link>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link
            href="https://beets.fi/terms-of-use"
            className="hover:text-foreground"
          >
            Terms of Use
          </Link>
          <Link href="https://x.com/beets_fi" className="hover:text-foreground">
            Twitter
          </Link>
          <Link
            href="https://beets.fi/discord"
            className="hover:text-foreground"
          >
            Discord
          </Link>
        </nav>
      </div>
    </footer>
  );
}
