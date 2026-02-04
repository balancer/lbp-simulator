"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Live() {
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    animate(sectionRef.current, {
      translateY: [24, 0],
      opacity: [0, 1],
      duration: 650,
      easing: "easeOutExpo",
    });
  }, []);

  return (
    <section className="w-full container mx-auto max-w-5xl px-4 md:px-6 mb-16 md:mb-20">
      <div
        ref={sectionRef}
        className="relative overflow-hidden rounded-[36px] border border-[#171717]/10 bg-white dark:border-white/10 dark:bg-[#171717]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(230,200,163,0.22),transparent_45%),radial-gradient(circle_at_80%_40%,rgba(23,23,23,0.08),transparent_40%)] dark:bg-[radial-gradient(circle_at_25%_20%,rgba(230,200,163,0.18),transparent_45%),radial-gradient(circle_at_80%_40%,rgba(230,200,163,0.12),transparent_40%)]" />
        <div className="relative grid gap-10 px-8 py-10 md:grid-cols-[1.15fr_0.85fr] md:items-center md:px-12 md:py-14">
          <div className="flex flex-col gap-4 text-left text-[#171717] dark:text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-[#171717]/60 dark:text-[#E6C8A3]/70">
              Live on Balancer
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Launch, divest, and buy back tokens—securely on-chain.
            </h2>
            <p className="text-base md:text-lg text-[#171717]/70 dark:text-white/70 max-w-lg">
              Launch with confidence using programmable LBP mechanics built for
              fair price discovery and transparent allocation.
            </p>
            <div className="mt-4">
              <Link href='/lbp-simulator'>
                <Button
                  size="lg"
                  className="bg-[#E6C8A3] text-[#171717] hover:bg-[#E6C8A3]/80 rounded-full px-8"
                >
                  Simulate your LBP
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative ml-auto h-[260px] w-full max-w-[360px] rounded-[28px] border border-[#171717]/10 bg-gradient-to-br from-white via-[#f8f4ee] to-[#f1e7d8] p-6 shadow-[0_24px_60px_rgba(23,23,23,0.16)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#1f1f1f] dark:via-[#1a1a1a] dark:to-[#2a221a] dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              <div className="absolute inset-0 rounded-[28px] bg-[linear-gradient(120deg,rgba(230,200,163,0.25),transparent_55%)] dark:bg-[linear-gradient(120deg,rgba(230,200,163,0.2),transparent_50%)]" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-center justify-between text-xs text-[#171717]/60 dark:text-white/60">
                  <span>Live curve</span>
                  <span>Make a swap</span>
                </div>
                <div className="mt-4 grid h-full grid-cols-8 items-end gap-1">
                  {[
                    "h-full",
                    "h-[85%]",
                    "h-[72%]",
                    "h-[62%]",
                    "h-[54%]",
                    "h-[46%]",
                    "h-[38%]",
                    "h-[30%]",
                  ].map((height, index) => (
                    <div
                      key={`bar-${index}`}
                      className={`w-full rounded-lg ${height} bg-gradient-to-t from-[#E6C8A3] via-[#E1B782] to-[#EADBC8]`}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-[#171717]/60 dark:text-white/60">
                  <span>Budget</span>
                  <span className="text-[#171717] dark:text-white">$50 USDC</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[#171717]/60 dark:text-white/60">
                  <span>Token price</span>
                  <span className="text-[#171717] dark:text-white">$1.50 USDC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
