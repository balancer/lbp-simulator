"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCcw, Rocket, TrendingDown } from "lucide-react";

const SLIDES = [
  {
    id: 1,
    title: "Buy Back",
    description:
      "Programmatic buy-backs with transparent price discovery and predictable liquidity.",
    Icon: RefreshCcw,
  },
  {
    id: 2,
    title: "Token Launches",
    description:
      "Fair price discovery for new tokens. Let the market find the right price through an LBP.",
    Icon: Rocket,
  },
  {
    id: 3,
    title: "Divestment",
    description:
      "Gradual, market-driven divestment with configurable weights and transparent execution.",
    Icon: TrendingDown,
  },
];

const CARD_LAYOUT = [
  { offsetX: -160, rotate: -4, baseOpacity: 1, baseZ: 10 },
  { offsetX: 0, rotate: 0, baseOpacity: 1, baseZ: 20 },
  { offsetX: 160, rotate: 4, baseOpacity: 1, baseZ: 12 },
];

type UseCasesProps = {
  activeIndex: number;
  onSelect: (index: number) => void;
};

const UseCases = ({ activeIndex, onSelect }: UseCasesProps) => {
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const animateDeck = useCallback(
    (focusIndex: number) => {
      wrapperRefs.current.forEach((wrapper, index) => {
        const card = cardRefs.current[index];
        if (!wrapper || !card) return;
        const layout = CARD_LAYOUT[index];
        const isFocused = focusIndex === index;
        const scale = isFocused ? 1.1 : 1;

        animate(wrapper, {
          translateX: layout.offsetX,
          rotate: layout.rotate,
          scale,
          duration: 420,
          easing: "easeOutQuad",
        });

        animate(card, {
          boxShadow: isFocused
            ? "0 24px 60px rgba(230, 200, 163, 0.35)"
            : "0 18px 35px rgba(15, 23, 42, 0.2)",
          duration: 420,
          easing: "easeOutQuad",
        });
      });
    },
    [],
  );

  useEffect(() => {
    wrapperRefs.current.forEach((wrapper, index) => {
      if (!wrapper) return;
      const layout = CARD_LAYOUT[index];
      wrapper.style.transform = `translateX(${layout.offsetX}px) translateY(0px) rotate(${layout.rotate}deg) scale(1)`;
      wrapper.style.opacity = "1";
    });
    cardRefs.current.forEach((card) => {
      if (!card) return;
      card.style.boxShadow = "0 18px 35px rgba(15, 23, 42, 0.2)";
    });

    animateDeck(activeIndex);
  }, [activeIndex, animateDeck]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const node = sectionRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        animate(node, {
          translateY: [24, 0],
          opacity: [0, 1],
          duration: 650,
          easing: "easeOutExpo",
        });
        observer.disconnect();
      },
      { threshold: 0.2 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="w-full container mx-auto max-w-5xl px-4 md:px-6 flex flex-col items-start justify-start opacity-0 translate-y-6"
    >
      <div className="flex items-center justify-center text-4xl w-full mb-20">
        One solution, multiple applications.
      </div>
      <div className="flex flex-col items-start w-full gap-10 flex-1 justify-start max-w-full">
        <div className="relative w-full flex items-center justify-center min-h-[420px] md:min-h-[480px]">
          {SLIDES.map((slide, index) => (
            <div
              key={slide.id}
              ref={(node) => {
                wrapperRefs.current[index] = node;
              }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                zIndex:
                  activeIndex === index
                    ? 40
                    : hoverIndex === index
                      ? 35
                    : index === 1
                      ? 30
                      : CARD_LAYOUT[index].baseZ,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  onSelect(index);
                }}
                onMouseEnter={() => {
                  setHoverIndex(index);
                  const wrapper = wrapperRefs.current[index];
                  if (!wrapper) return;
                  if (index === activeIndex) return;
                  animate(wrapper, {
                    translateY: { to: -120 },
                    duration: 220,
                    easing: "easeOutQuad",
                  });
                }}
                onMouseLeave={() => {
                  setHoverIndex((current) =>
                    current === index ? null : current,
                  );
                  const wrapper = wrapperRefs.current[index];
                  if (!wrapper) return;
                  animate(wrapper, {
                    translateY: { to: index === activeIndex ? -18 : 0 },
                    duration: 220,
                    easing: "easeOutQuad",
                  });
                }}
                className="border-0 bg-transparent p-0 text-left cursor-pointer focus:outline-none"
              >
                <Card
                  ref={(node) => {
                    cardRefs.current[index] = node;
                  }}
                  className={cn(
                    "h-[42vh] min-h-[320px] w-[260px] md:w-[320px] flex flex-col border border-border/60 bg-background backdrop-blur",
                    activeIndex === index &&
                      "border-primary/40 h-[46vh] min-h-[360px] w-[300px] md:w-[360px] bg-background",
                  )}
                >
                  <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
                    <CardTitle className="text-base md:text-lg font-semibold">
                      {slide.title}
                    </CardTitle>
                    <slide.Icon className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="pt-0 text-sm text-muted-foreground flex-1">
                    {slide.description}
                  </CardContent>
                </Card>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UseCases;
