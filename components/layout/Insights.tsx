"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate } from "animejs";
import { cn } from "@/lib/utils";

type InsightsProps = {
  activeIndex: number;
};

type InsightItem = {
  subtitle: string;
  paragraph: string;
  visual: "reverse-curve" | "slippage" | "arbitrage" | "default-bars";
};

const INSIGHTS = [
  {
    title: "Buy Back Strategy",
    items: [
      {
        subtitle: "Use a reverse LBP",
        paragraph:
          "By inverting the weighting curve, LBP tends to pay more and more for a token.",
        visual: "reverse-curve",
      },
      {
        subtitle: "Buy with secure slippage",
        paragraph:
          "The gradual price increase based on weights ensures purchases that will not deplete the token's value.",
        visual: "slippage",
      },
      {
        subtitle: "Let the arbitrators do the rest",
        paragraph:
          "Arbitrageurs naturally correct price drift to keep the curve fair.",
        visual: "arbitrage",
      },
    ],
  },
  {
    title: "Token Launch Strategy",
    items: [
      {
        subtitle: "Start high",
        paragraph: "Use a higher initial token weight for clean discovery.",
        visual: "default-bars",
      },
      {
        subtitle: "Stabilize demand",
        paragraph: "Shift weights gradually as demand settles.",
        visual: "default-bars",
      },
      {
        subtitle: "Communicate rules",
        paragraph: "Make the schedule and parameters visible to buyers.",
        visual: "default-bars",
      },
    ],
  },
  {
    title: "Divestment Strategy",
    items: [
      {
        subtitle: "Predictable release",
        paragraph: "Schedule divestment intervals that the market expects.",
        visual: "default-bars",
      },
      {
        subtitle: "Market-driven price",
        paragraph: "Let demand set the clearing price each interval.",
        visual: "default-bars",
      },
      {
        subtitle: "Stakeholder clarity",
        paragraph: "Keep reporting transparent through each phase.",
        visual: "default-bars",
      },
    ],
  },
];

export function Insights({ activeIndex }: InsightsProps) {
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement | null>(null);

  const data = useMemo(() => INSIGHTS[activeIndex], [activeIndex]);

  const renderVisual = (item: InsightItem, index: number) => {
    if (item.visual === "reverse-curve") {
      return (
        <div className="h-[80px] w-full rounded-xl border border-border/50 bg-background/70 p-3">
          <svg viewBox="0 0 160 80" className="h-full w-full">
            <path
              d="M10 70 C 45 55, 100 40, 150 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-foreground/60"
            />
            <circle cx="150" cy="10" r="4" className="fill-foreground/70" />
          </svg>
        </div>
      );
    }

    if (item.visual === "slippage") {
      return (
        <div className="h-[80px] w-full rounded-xl border border-border/50 bg-background/70 p-3">
          <svg viewBox="0 0 160 80" className="h-full w-full">
            <path
              d="M10 60 L 150 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-foreground/70"
            />
            <path
              d="M10 55 L 150 35"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-foreground/35"
            />
            <rect
              x="30"
              y="34"
              width="100"
              height="20"
              rx="6"
              className="fill-foreground/10"
            />
          </svg>
        </div>
      );
    }

    if (item.visual === "arbitrage") {
      return (
        <div className="h-[80px] w-full rounded-xl border border-border/50 bg-background/70 p-3">
          <svg viewBox="0 0 160 80" className="h-full w-full">
            <path
              d="M10 50 L 150 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-foreground/25"
            />
            <path
              d="M10 30 L 80 30 L 110 50 L 150 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-foreground/70"
            />
            <path
              d="M110 50 L 120 40 L 120 48 L 130 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-foreground/50"
            />
          </svg>
        </div>
      );
    }

    return (
      <div className="h-[80px] w-full rounded-xl border border-border/50 bg-background/70 p-3">
        <div className="grid h-full grid-cols-6 items-end gap-1">
          {[
            "h-[85%]",
            "h-[70%]",
            "h-[55%]",
            "h-[65%]",
            "h-[45%]",
            "h-[35%]",
          ].map((height, barIndex) => (
            <div
              key={`${index}-bar-${barIndex}`}
              className={cn("w-full rounded-md bg-foreground/25", height)}
            />
          ))}
        </div>
      </div>
    );
  };

  useEffect(() => {
    rowsRef.current.forEach((row, index) => {
      if (!row) return;
      row.style.opacity = "0";
      row.style.transform = `translateX(${index % 2 === 0 ? 28 : -28}px)`;
    });
  }, [activeIndex]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const node = sectionRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        rowsRef.current.forEach((row, index) => {
          if (!row) return;
          animate(row, {
            translateX: [index % 2 === 0 ? 28 : -28, 0],
            translateY: [16, 0],
            opacity: [0, 1],
            duration: 700,
            delay: index * 120,
            easing: "easeOutExpo",
          });
        });
        observer.disconnect();
      },
      { threshold: 0.2 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeIndex]);

  return (
    <section
      ref={sectionRef}
      className="w-full container mx-auto max-w-5xl px-4 md:px-6 mt-12 md:mt-16"
    >
      <div className="flex flex-col gap-8">
        <h3 className="text-xl md:text-2xl font-semibold text-foreground">
          {data.title}
        </h3>
        {data.items.map((item, index) => (
          <div
            key={`${data.title}-${index}`}
            ref={(node) => {
              rowsRef.current[index] = node;
            }}
            className={cn(
              "w-full rounded-2xl border border-border/60 bg-card/80 px-6 py-4 text-sm md:text-base text-foreground/90 shadow-[0_12px_30px_rgba(15,23,42,0.08)]",
            )}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <div className="text-lg font-bold text-foreground">
                  {item.subtitle}
                </div>
                <div className="mt-1 text-sm md:text-base text-muted-foreground">
                  {item.paragraph}
                </div>
              </div>
              <div className="w-full md:w-[180px]">
                {renderVisual(item as InsightItem, index)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
