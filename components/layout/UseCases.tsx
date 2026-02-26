"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { cn } from "@/lib/utils";
import { Check, Link2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RefreshCcw, Rocket, TrendingDown } from "lucide-react";
import { UseCaseStudyDialog } from "@/components/layout/UseCaseStudyDialog";
import mplPriceData from "@/public/data/mpl-price.json";

const SLIDES = [
  {
    id: 1,
    slug: "buy-back",
    title: "Buy Back",
    description:
      "Automated buybacks with transparent price discovery and controlled market impact.",
    benefits: ["Market Stability", "Fair Pricing", "Transparent Execution"],
    Icon: RefreshCcw,
    caseStudy: {
      title: "Institutional-Scale Buybacks with rLBPs",
      summary:
        "TempleDAO executed a $43.19M on-chain buyback using a reverse Liquidity Bootstrapping Pool (rLBP)—representing 98.5% of all volume in our dataset. The rLBP acted as a moving limit order, tightly tracking external prices and minimizing slippage while outsourcing timing risk to arbitrageurs.",
      whatHappened:
        "Using DAI and FRAX, TempleDAO accumulated TEMPLE via standard and NoProtocolFee rLBP factories. Across 3,870 trades, the pool price closely followed the external market, with arbitrageurs correcting any deviations in real time.",
      showCurve: true,
      keyResults: [
        "Avg. execution premium: +0.13% (13 bps above spot)",
        "Total volume: $43.19M",
        "Markout: -0.12% (neutral-to-healthy inventory selection)",
        "Price behavior: strong adherence to market price, minimal decoupling",
      ],
      rightChoice: [
        "Near-spot execution at scale without market impact",
        "Arbitrage-enforced price discipline (no sustained mispricing)",
        "Clean inventory accumulation without buying local tops",
      ],
    },
  },
  {
    id: 2,
    slug: "token-launches",
    title: "Token Launches",
    description:
      "Let the market set the price. Fairly, transparently, and without bot interference.",
    benefits: ["No Bot Sniping", "Deep Initial Liquidity", "Community Driven"],
    Icon: Rocket,
    caseStudy: {
      title: "Maple LBP Public Launch",
      summary:
        "Maple DAO ran a public LBP sale to distribute 5% of MPL supply in a fixed 72-hour window, using on-chain price discovery for broad access.",
      whatHappened:
        "Maple DAO proposed depositing 500,000 MPL and 850,000 USDC into a Balancer LBP. The pool opened at 4:30pm EST on April 28, 2021, ran for 72 hours, and returned raised USDC plus any remaining MPL to the DAO multisig afterward.",
      keyResults: [
        "500,000 MPL (5% of supply) allocated for the public sale",
        "72-hour, time-boxed sale window (April 28, 2021)",
        "Expected proceeds: 5m–7.5m USDC",
      ],
      rightChoice: [
        "Fixed schedule gave all buyers equal access to the launch window",
        "Pre-funded liquidity made price discovery transparent on-chain",
        "DAO multisig approvals provided governance oversight of transfers",
      ],
      chart: {
        type: "mpl-price",
        title: "Post-launch MPL Price",
        caption: "Source: MPL price dataset (USD, Apr 29–May 13, 2021).",
        data: mplPriceData.map((point) => point.price),
      },
    },
  },
  {
    id: 3,
    slug: "divestment",
    title: "Investment & Divestment",
    description:
      "Gradually enter or exit positions with configurable parameters and minimal price impact.",
    benefits: ["Minimal Price Impact", "Controlled Flow", "Verified Discovery"],
    Icon: TrendingDown,
    caseStudy: {
      title: "Gitcoin’s AKITA Divestment via LBP",
      summary:
        "Gitcoin used a Balancer LBP to gradually divest a large AKITA donation, creating predictable sell pressure and deeper liquidity without a sudden market dump.",
      whatHappened:
        "Gitcoin placed AKITA and WETH in a Balancer LBP (99% AKITA / 1% WETH) via Fjord Foundry, then slowly shifted weights over a year toward 99% WETH / 1% AKITA. The LBP both sold AKITA into the market and bought AKITA as needed to maintain the changing weights, while collecting swap fees.",
      keyResults: [
        "LBP concluded on December 19, 2022",
        "23,437,196,448,684.83 AKITA released",
        "3,812.98 WETH accrued during the sale",
      ],
      rightChoice: [
        "Gradual weight shifts turned a large position into orderly flow",
        "Market demand, not a single dump, set the clearing price",
        "Swap fees added incremental yield during divestment",
      ],
      chart: {
        type: "akita-weights",
        title: "AKITA Divestment Weight Shift",
        caption: "Modeled weight change from 99/1 to 1/99 over the sale.",
      },
    },
  },
] as const satisfies ReadonlyArray<{
  id: number;
  slug: string;
  title: string;
  description: string;
  benefits?: string[];
  Icon: typeof RefreshCcw;
  caseStudy: {
    title: string;
    summary: string;
    takeaways?: string[];
    whatHappened?: string;
    keyResults?: string[];
    rightChoice?: string[];
    showCurve?: boolean;
    chart?: {
      type: "mpl-price" | "akita-weights";
      title: string;
      caption?: string;
      data?: number[];
    };
  };
}>;

const CARD_LAYOUT = [
  { offsetX: -160, rotate: -4, baseOpacity: 1, baseZ: 10 },
  { offsetX: 0, rotate: 0, baseOpacity: 1, baseZ: 20 },
  { offsetX: 160, rotate: 4, baseOpacity: 1, baseZ: 12 },
];

const getVisualPosition = (slideIndex: number, activeIndex: number) => {
  if (slideIndex === activeIndex) return 0;
  const remaining = SLIDES.map((_, idx) => idx).filter(
    (idx) => idx !== activeIndex,
  );
  return remaining.indexOf(slideIndex) + 1;
};

type UseCasesProps = {
  activeIndex: number;
  onSelect: (index: number) => void;
  openCaseSlug?: string | null;
};

const UseCases = ({ activeIndex, onSelect, openCaseSlug }: UseCasesProps) => {
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [hoverSlideIndex, setHoverSlideIndex] = useState<number | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const buildCaseUrl = useCallback((slug: string) => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("case", slug);
    return url.toString();
  }, []);

  const animateDeck = useCallback(
    (currentActiveIndex: number) => {
      SLIDES.forEach((_, slideIndex) => {
        const wrapper = wrapperRefs.current[slideIndex];
        const card = cardRefs.current[slideIndex];
        if (!wrapper || !card) return;

        const position = getVisualPosition(slideIndex, currentActiveIndex);
        const layout = CARD_LAYOUT[position];
        const isFocused = position === 0;
        const scale = isFocused ? 1.1 : 1;
        const mobileOffsetY = position === 0 ? -8 : position === 1 ? -28 : -48;
        const translateX = isMobile ? 0 : layout.offsetX;
        const translateY = isMobile ? mobileOffsetY : isFocused ? -18 : 0;
        const rotate = isMobile ? 0 : layout.rotate;
        const deckScale = isMobile ? 1 : scale;

        animate(wrapper, {
          translateX,
          translateY,
          rotate,
          scale: deckScale,
          duration: 420,
          easing: "easeOutQuad",
        });

        // Set z-index immediately to prevent overlap issues during transition
        wrapper.style.zIndex = (isFocused ? 40 : layout.baseZ).toString();

        animate(card, {
          boxShadow: isFocused
            ? "0 24px 60px rgba(230, 200, 163, 0.35)"
            : "0 18px 35px rgba(15, 23, 42, 0.2)",
          duration: 420,
          easing: "easeOutQuad",
        });
      });
    },
    [isMobile],
  );

  useEffect(() => {
    // Initialize styles for all slides
    SLIDES.forEach((_, slideIndex) => {
      const wrapper = wrapperRefs.current[slideIndex];
      const card = cardRefs.current[slideIndex];
      if (!wrapper || !card) return;

      const position = getVisualPosition(slideIndex, activeIndex);
      const layout = CARD_LAYOUT[position];
      const isFocused = position === 0;
      const mobileOffsetY = position === 0 ? -8 : position === 1 ? -28 : -48;
      const translateX = isMobile ? 0 : layout.offsetX;
      const translateY = isMobile ? mobileOffsetY : isFocused ? -18 : 0;
      const rotate = isMobile ? 0 : layout.rotate;
      const deckScale = isMobile ? 1 : isFocused ? 1.1 : 1;

      wrapper.style.transform = `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg) scale(${deckScale})`;
      wrapper.style.opacity = "1";
      wrapper.style.zIndex = (isFocused ? 40 : layout.baseZ).toString();
      card.style.boxShadow = isFocused
        ? "0 24px 60px rgba(230, 200, 163, 0.35)"
        : "0 18px 35px rgba(15, 23, 42, 0.2)";
    });
  }, [isMobile]);

  useEffect(() => {
    animateDeck(activeIndex);
  }, [activeIndex, animateDeck]);

  useEffect(() => {
    if (!openCaseSlug) return;
    setOpenSlug(openCaseSlug);
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [openCaseSlug]);

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

  useEffect(() => {
    const updateLayout = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 640);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="use-cases"
      className="w-full container mx-auto max-w-5xl px-4 md:px-6 md:py-4 flex flex-col items-start justify-start opacity-0 translate-y-6"
    >
      <div className="flex items-center justify-center text-4xl w-full mb-12">
        One solution, multiple applications.
      </div>
      <div className="flex flex-col items-start w-full gap-10 flex-1 justify-start max-w-full">
        <div className="relative w-full flex items-center justify-center min-h-[600px] md:min-h-[720px]">
          {SLIDES.map((slide, slideIndex) => {
            const position = getVisualPosition(slideIndex, activeIndex);
            const isFocused = position === 0;
            const isHovered = hoverSlideIndex === slideIndex;
            const layout = CARD_LAYOUT[position];

            return (
              <div
                key={slide.id}
                ref={(node) => {
                  wrapperRefs.current[slideIndex] = node;
                }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  zIndex: isFocused ? 40 : position === 1 ? 30 : 20,
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelect(slideIndex);
                  }}
                  onMouseEnter={() => {
                    if (isFocused) return;
                    setHoverSlideIndex(slideIndex);
                    const wrapper = wrapperRefs.current[slideIndex];
                    if (!wrapper) return;
                    animate(wrapper, {
                      translateY: -12,
                      duration: 220,
                      easing: "easeOutQuad",
                    });
                  }}
                  onMouseLeave={() => {
                    setHoverSlideIndex(null);
                    const wrapper = wrapperRefs.current[slideIndex];
                    if (!wrapper) return;
                    animate(wrapper, {
                      translateY: isFocused ? -18 : 0,
                      duration: 220,
                      easing: "easeOutQuad",
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(slideIndex);
                    }
                  }}
                  className={cn(
                    "border-0 bg-transparent p-0 text-left focus:outline-none",
                    isFocused ? "cursor-default" : "cursor-pointer",
                  )}
                >
                  <Card
                    ref={(node) => {
                      cardRefs.current[slideIndex] = node;
                    }}
                    className={cn(
                      "h-[57vh] min-h-[460px] w-[320px] md:w-[380px] flex flex-col overflow-hidden border border-border/60 bg-background backdrop-blur transition-colors",
                      isFocused && "border-primary/40 bg-background",
                    )}
                  >
                    <div className="relative h-40 md:h-48 w-full overflow-hidden bg-muted/20">
                      <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle, #fff 1px, transparent 1px)",
                          backgroundSize: "20px 20px",
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <slide.Icon className="h-20 w-20 text-foreground stroke-1" />
                      </div>
                      <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-transparent" />
                    </div>
                    <CardHeader className="pb-2 grid grid-cols-[1fr_auto] items-start gap-4">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <CardTitle className="min-w-0 text-base md:text-lg font-semibold leading-tight">
                          {slide.title}
                        </CardTitle>
                        <button
                          type="button"
                          aria-label={`Copy ${slide.title} link`}
                          className={cn(
                            "rounded-full border px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all",
                            copiedSlug === slide.slug
                              ? "border-[#E6C8A3] bg-[#E6C8A3] text-[#171717]"
                              : "border-[#E6C8A3] text-[#E6C8A3] hover:bg-[#E6C8A3]/15",
                            !isFocused &&
                              "cursor-not-allowed opacity-50 hover:bg-transparent",
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!isFocused) {
                              onSelect(slideIndex);
                              return;
                            }
                            const url = buildCaseUrl(slide.slug);
                            if (!url) return;
                            void navigator.clipboard?.writeText(url);
                            setCopiedSlug(slide.slug);
                            window.setTimeout(() => {
                              setCopiedSlug((current) =>
                                current === slide.slug ? null : current,
                              );
                            }, 1600);
                          }}
                          onPointerDown={(event) => {
                            if (isFocused) {
                              event.stopPropagation();
                            }
                          }}
                        >
                          {copiedSlug === slide.slug ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Link2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <slide.Icon className="h-5 w-5 text-foreground" />
                    </CardHeader>
                    <CardContent className="pt-0 text-sm text-muted-foreground flex-1 flex flex-col gap-4">
                      <p>{slide.description}</p>
                      {slide.benefits && (
                        <ul className="space-y-2 border-t border-border/40 pt-4">
                          {slide.benefits.map((benefit, i) => (
                            <li
                              key={i}
                              className="flex items-center gap-2 text-xs"
                            >
                              <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                    <CardFooter className="pt-4 w-full justify-start">
                      <UseCaseStudyDialog
                        caseStudy={slide.caseStudy}
                        open={openSlug === slide.slug}
                        onOpenChange={(nextOpen) => {
                          setOpenSlug(nextOpen ? slide.slug : null);
                        }}
                      />
                    </CardFooter>
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UseCases;
