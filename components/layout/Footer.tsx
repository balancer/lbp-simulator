import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 py-8 mt-20">
      <div className="w-full container mx-auto max-w-7xl px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 bg-zinc-900 rounded-lg flex items-center justify-center text-white text-xs font-bold">
            B
          </div>
          <span className="text-sm font-semibold text-muted-foreground">
            © Balancer Labs
          </span>
        </div>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link href="#" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="#" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="#" className="hover:text-foreground">
            Twitter
          </Link>
          <Link href="#" className="hover:text-foreground">
            Discord
          </Link>
        </nav>
      </div>
    </footer>
  );
}
