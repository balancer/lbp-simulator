"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate } from "animejs";
import { cn } from "@/lib/utils";

type InsightsProps = {
  activeIndex: number;
};

const INSIGHTS = [
  {
    title: "Buy Back Strategy",
    items: [
      {
        subtitle: "Use a reverse LBP",
        paragraph: "By inverting the weighting curve, LBP tends to pay more and more for a token.",
      },
      {
        subtitle: "Buy with secure slippage",
        paragraph: "The gradual price increase based on the pesos ensures purchases that will not deplete the token's value.",
      },
      {
        subtitle: "Stay transparent",
        paragraph: "Publish parameters so stakeholders can track execution.",
      },
    ],
  },
  {
    title: "Token Launch Strategy",
    items: [
      {
        subtitle: "Start high",
        paragraph: "Use a higher initial token weight for clean discovery.",
      },
      {
        subtitle: "Stabilize demand",
        paragraph: "Shift weights gradually as demand settles.",
      },
      {
        subtitle: "Communicate rules",
        paragraph: "Make the schedule and parameters visible to buyers.",
      },
    ],
  },
  {
    title: "Divestment Strategy",
    items: [
      {
        subtitle: "Predictable release",
        paragraph: "Schedule divestment intervals that the market expects.",
      },
      {
        subtitle: "Market-driven price",
        paragraph: "Let demand set the clearing price each interval.",
      },
      {
        subtitle: "Stakeholder clarity",
        paragraph: "Keep reporting transparent through each phase.",
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
            <div className="text-lg font-bold text-foreground">
              {item.subtitle}
            </div>
            <div className="mt-1 text-sm md:text-base text-muted-foreground">
              {item.paragraph}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
