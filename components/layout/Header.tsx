"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { useTheme } from "next-themes";
import { useEffect, useState, useRef, memo, useMemo } from "react";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 60;

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    )
      return parent;
    parent = parent.parentElement;
  }
  return null;
}

function HeaderComponent() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    const scrollParent = getScrollParent(el);
    if (!scrollParent) return;

    const handleScroll = () => {
      const y = scrollParent.scrollTop;
      const scrollingDown = y > lastScrollY.current;
      lastScrollY.current = y;

      setHidden((prev) => {
        if (y <= SCROLL_THRESHOLD) return false;
        if (scrollingDown) return true;
        return false;
      });
    };

    scrollParent.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollParent.removeEventListener("scroll", handleScroll);
  }, [mounted]);

  const logoSrc = useMemo(() => {
    return mounted && resolvedTheme === "dark"
      ? "/logo-balancer-white.svg"
      : "/logo-balancer-black.svg";
  }, [mounted, resolvedTheme]);

  return (
    <header
      ref={headerRef}
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60 transition-transform duration-300 ease-out",
        hidden && "-translate-y-full",
      )}
    >
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
            <Button className="hidden md:inline-flex bg-gradient-to-r from-blue-300 via-purple-300 to-orange-300 hover:from-blue-400 hover:via-purple-400 hover:to-orange-400 text-slate-900 font-semibold rounded-xl px-6 h-11 items-center gap-2 transition-colors duration-200 cursor-pointer">
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
