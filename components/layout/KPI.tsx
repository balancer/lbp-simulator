"use client";

import { useEffect, useRef, useState } from "react";
import { createTimer, cubicBezier } from "animejs";

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) {
    return `+$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `+$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `+$${value.toLocaleString()}`;
}

function formatCount(value: number) {
  return `+${Math.round(value).toLocaleString()}`;
}

export function KPI() {
  const [raised, setRaised] = useState(0);
  const [pools, setPools] = useState(0);
  const [participants, setParticipants] = useState(0);
  const hasAnimated = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!sectionRef.current || hasAnimated.current) return;

    const node = sectionRef.current;
    const scrollRoot = document.getElementById("app-scroll");
    const easeInOut = cubicBezier(0.65, 0, 0.35, 1);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;

        createTimer({
          duration: 1400,
          onUpdate: (self) => {
            const progress = Math.min(self.currentTime / self.duration, 1);
            const eased = easeInOut(progress);
            setRaised(eased * 1_000_000_000);
          },
        });

        createTimer({
          duration: 1200,
          onUpdate: (self) => {
            const progress = Math.min(self.currentTime / self.duration, 1);
            const eased = easeInOut(progress);
            setPools(eased * 960);
          },
        });

        createTimer({
          duration: 1300,
          onUpdate: (self) => {
            const progress = Math.min(self.currentTime / self.duration, 1);
            const eased = easeInOut(progress);
            setParticipants(eased * 90_000);
          },
        });

        observer.disconnect();
      },
      { threshold: 0.3, root: scrollRoot ?? null },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="w-full container mx-auto max-w-5xl px-4 md:px-6 mb-14 md:mb-16"
    >
      <div className="grid gap-12 rounded-[28px] bg-background/80 px-6 py-8 md:grid-cols-3 md:px-10 items-center justify-center">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Historical amount raised
          </div>
          <div className="text-4xl md:text-5xl font-semibold text-[#E6C8A3]">
            {formatCurrency(raised)}
          </div>
          <div className="text-sm text-muted-foreground">
            Liquidity bootstrapped through on-chain auctions.
          </div>
        </div>
        <div className="flex flex-col items-center text-center gap-2">
          <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            LBP pools created
          </div>
          <div className="text-4xl md:text-5xl font-semibold text-[#E6C8A3]">
            {formatCount(pools)}
          </div>
          <div className="text-sm text-muted-foreground">
            Verified launches across ecosystems and communities.
          </div>
        </div>
        <div className="flex flex-col items-center text-center gap-2">
          <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Unique participants
          </div>
          <div className="text-4xl md:text-5xl font-semibold text-[#E6C8A3]">
            {formatCount(participants)}
          </div>
          <div className="text-sm text-muted-foreground">
            Unique participants across LBP launches.
          </div>
        </div>
      </div>
    </section>
  );
}
