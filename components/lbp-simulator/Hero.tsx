"use client";

import { useEffect, useRef } from "react";
import { animate, splitText } from "animejs";

export function Hero() {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const subtitleRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!titleRef.current || !subtitleRef.current) return;

    const titleSplit = splitText(titleRef.current, { words: true });
    const subtitleSplit = splitText(subtitleRef.current, { words: true });

    animate(titleSplit.words, {
      translateY: [24, 0],
      opacity: [0, 1],
      duration: 900,
      easing: "easeOutExpo",
      delay: (_el: any, index: number) => index * 40,
    });

    animate(subtitleSplit.words, {
      translateY: [18, 0],
      opacity: [0, 1],
      duration: 560,
      easing: "easeOutExpo",
      delay: (_el: any, index: number) => 160 + index * 28,
    });
  }, []);

  return (
    <section className="w-full container mx-auto max-w-5xl flex flex-col items-center justify-center pt-20 pb-12 md:pt-28 md:pb-16 px-4 md:px-6 text-center gap-2">
      <h1
        ref={titleRef}
        className="text-4xl md:text-6xl lg:text-7xl text-foreground tracking-tight mb-6"
      >
        Launch the next disruptive token
      </h1>
      <p
        ref={subtitleRef}
        className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8"
      >
        Programmable, on-chain price discovery for fair token launches, and
        more.
      </p>
    </section>
  );
}
