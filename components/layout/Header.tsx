"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { useTheme } from "next-themes";
import { useEffect, useState, memo, useMemo } from "react";

function HeaderComponent() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = useMemo(() => {
    return mounted && resolvedTheme === "dark"
      ? "/logo-balancer-white.svg"
      : "/logo-balancer-black.svg";
  }, [mounted, resolvedTheme]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
      <div className="w-full container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src={logoSrc} alt="Balancer Logo" width={30} height={30} />
            <span className="text-xl font-bold tracking-tight">Balancer</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="#"
            className="text-sm font-medium text-muted-foreground hover:text-foreground md:hidden"
          >
            Menu
          </Link>
          <ModeToggle />
          <Link href="https://balancer.fi/">
            <Button className="hidden md:inline-flex bg-gradient-to-r from-blue-300 via-purple-300 to-orange-300 hover:from-blue-400 hover:via-purple-400 hover:to-orange-400 text-slate-900 font-semibold rounded-xl px-6 h-11 items-center gap-2 transition-colors duration-200">
              Build on Balancer
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export const Header = memo(HeaderComponent);
