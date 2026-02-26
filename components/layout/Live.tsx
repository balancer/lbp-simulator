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

  const progress = 0.55; // mid-sale example for the marketing card
  const progressLabel = `${Math.round(progress * 100)}%`;

  const curveD = (() => {
    const startY = 10;
    const endY = 54;
    const k = 3.2;
    const points = Array.from({ length: 26 }, (_, i) => {
      const t = i / 25;
      const x = 100 * t;
      const y = startY + (endY - startY) * (1 - Math.exp(-k * t));
      return { x, y };
    });

    return points
      .map(
        (p, idx) =>
          `${idx === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
      )
      .join(" ");
  })();

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
              Launch, divest, and buy back tokens, all transparent.
            </h2>
            <p className="text-base md:text-lg text-[#171717]/70 dark:text-white/70 max-w-lg">
              Built for fair price discovery and minimal market impact, whether
              you're launching a token, executing a buyback, or divesting a
              treasury position.
            </p>
            <div className="mt-4">
              <Link href="/lbp-simulator">
                <Button
                  size="lg"
                  className="relative overflow-hidden rounded-full px-8 text-[#171717] bg-gradient-to-r from-[#F1D7B2] via-[#E6C8A3] to-[#D9B27D] border border-[#E6C8A3]/60 shadow-[0_0_24px_rgba(230,200,163,0.45)] hover:shadow-[0_0_32px_rgba(230,200,163,0.6)] transition-transform hover:scale-105"
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
                  <span>LBP price curve</span>
                  <span>{progressLabel} elapsed</span>
                </div>
                <div className="mt-4 flex-1 min-h-0 rounded-2xl border border-[#171717]/10 bg-white/40 p-3 dark:border-white/10 dark:bg-black/20">
                  <svg viewBox="0 0 100 60" className="h-full w-full">
                    <defs>
                      <linearGradient
                        id="lbpStroke"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#E6C8A3" stopOpacity="1" />
                        <stop
                          offset="55%"
                          stopColor="#E1B782"
                          stopOpacity="1"
                        />
                        <stop
                          offset="100%"
                          stopColor="#EADBC8"
                          stopOpacity="1"
                        />
                      </linearGradient>
                      <clipPath id="elapsedClip">
                        <rect x="0" y="0" width={100 * progress} height="60" />
                      </clipPath>
                      <clipPath id="remainingClip">
                        <rect
                          x={100 * progress}
                          y="0"
                          width={100 - 100 * progress}
                          height="60"
                        />
                      </clipPath>
                    </defs>

                    <path
                      d={curveD}
                      fill="none"
                      stroke="rgba(23,23,23,0.12)"
                      strokeWidth="1"
                      className="dark:hidden"
                    />
                    <path
                      d={curveD}
                      fill="none"
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="1"
                      className="hidden dark:block"
                    />

                    <path
                      d={curveD}
                      fill="none"
                      stroke="url(#lbpStroke)"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      clipPath="url(#elapsedClip)"
                    />
                    <path
                      d={curveD}
                      fill="none"
                      stroke="rgba(230,200,163,0.7)"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeDasharray="2 3"
                      clipPath="url(#remainingClip)"
                    />

                    <line
                      x1={100 * progress}
                      y1="4"
                      x2={100 * progress}
                      y2="58"
                      stroke="rgba(230,200,163,0.35)"
                      strokeWidth="0.75"
                    />
                  </svg>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-[#171717]/60 dark:text-white/60">
                  <span>Token price</span>
                  <span className="text-[#171717] dark:text-white">
                    $1.50 USDC
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
