import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 py-8 mt-20">
      <div className="w-full container mx-auto max-w-7xl px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">
            © Balancer Labs
          </span>
        </div>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link href="https://balancer.fi/terms-of-use" className="hover:text-foreground">
            Terms of use
          </Link>
          <Link href="https://balancer.fi/privacy-policy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="https://x.com/Balancer" className="hover:text-foreground">
            Twitter
          </Link>
          <Link href="https://discord.balancer.fi/" className="hover:text-foreground">
            Discord
          </Link>
        </nav>
      </div>
    </footer>
  );
}
