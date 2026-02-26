"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { animate, splitText } from "animejs";
import { Button } from "@/components/ui/button";
import { trackReportDownload } from "@/lib/analytics";

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
      delay: (_el, index) => index * 40,
    });

    animate(subtitleSplit.words, {
      translateY: [18, 0],
      opacity: [0, 1],
      duration: 560,
      easing: "easeOutExpo",
      delay: (_el, index) => 160 + index * 28,
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
        Programmable, on-chain price discovery for fair token launches, and more.
      </p>
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="https://v66oe78pzsm.typeform.com/to/XWW3ioRY"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="lg"
              className="bg-[#E6C8A3] hover:bg-[#E6C8A3]/80 text-[#171717] rounded-full px-8 text-base cursor-pointer"
            >
              Talk to us
            </Button>
          </Link>

          <Link
            href="https://docs.balancer.fi/concepts/explore-available-balancer-pools/liquidity-bootstrapping-pool/liquidity-bootstrapping-pool.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8 text-base hover:bg-[#E6C8A3]/50 cursor-pointer"
              style={{ cursor: "pointer" }}
            >
              Learn more
            </Button>
          </Link>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="rounded-full px-8 text-base border-[#E6C8A3]/60 hover:bg-[#E6C8A3]/10 cursor-pointer w-72"
          onClick={trackReportDownload}
        >
          Get the 961 LBP Analysis
        </Button>
      </div>
    </section>
  );
}
