"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate } from "animejs";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Clock,
  TrendingDown,
  RefreshCcw,
  Magnet,
  Coins,
  Settings2,
  ArrowDownRight,
  Search,
  LucideIcon,
} from "lucide-react";

type InsightsProps = {
  activeIndex: number;
};

type InsightItem = {
  subtitle: string;
  paragraph: string;
  Icon: LucideIcon;
};

const INSIGHTS = [
  {
    title: "Buy Back",
    items: [
      {
        subtitle: "Invert the Mechanics",
        paragraph:
          "Start with high collateral weight (e.g., 90% DAI) to create natural upward price pressure as weights shift.",
        Icon: RefreshCcw,
      },
      {
        subtitle: "Passive Accumulation",
        paragraph:
          "Function as an automated limit order: arbitrageurs fill your treasury with collateral as pool weights shift, requiring no active management.",
        Icon: Magnet,
      },
      {
        subtitle: "Preserve Capital",
        paragraph:
          "Execute institutional-scale volume with a marginal premium (as low as +0.15%), significantly cheaper than instant market buys.",
        Icon: Coins,
      },
    ],
  },
  {
    title: "Token Launch",
    items: [
      {
        subtitle: "Defend the Floor",
        paragraph:
          "Start with a high project weight (e.g., 95%+) to create a valuation buffer that absorbs early volatility and deters snipers.",
        Icon: ShieldCheck,
      },
      {
        subtitle: "Time it Right",
        paragraph:
          "Set a duration between 48 and 72 hours to maximize capital efficiency while minimizing algorithmic value extraction.",
        Icon: Clock,
      },
      {
        subtitle: "Smooth the Curve",
        paragraph:
          "Keep the weight slope below 0.6 to ensure the price decay acts as a discovery mechanism rather than a structural dump.",
        Icon: TrendingDown,
      },
    ],
  },
  {
    title: "Investment & Divestment",
    items: [
      {
        subtitle: "Programmed Release",
        paragraph:
          "Use controlled market pressure over time to build or unwind large positions, avoiding sudden price movements.",
        Icon: Settings2,
      },
      {
        subtitle: "Minimize Slippage",
        paragraph:
          "Apply controlled execution over time to enter or exit large positions, minimizing immediate market impact.",
        Icon: ArrowDownRight,
      },
      {
        subtitle: "Trade on a market fair price",
        paragraph:
          "The curvature of an LBP continuously ensures external attractiveness for interacting with the token, which in the long term generates trades always around a fair price.",
        Icon: Search,
      },
    ],
  },
];

export function Insights({ activeIndex }: InsightsProps) {
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement | null>(null);

  const data = useMemo(() => INSIGHTS[activeIndex], [activeIndex]);

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
              <div className="w-full md:w-[120px] flex justify-end">
                <div className="h-16 w-16 md:h-20 md:w-20 rounded-xl bg-muted/20 flex items-center justify-center border border-border/40">
                  <item.Icon className="h-8 w-8 md:h-10 md:w-10 text-white stroke-[1.5]" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
