"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSimulatorStore } from "@/store/useSimulatorStore";

export function Hero() {
  const setIsConfigOpen = useSimulatorStore((state) => state.setIsConfigOpen);

  const handleGetStartedClick = () => {
    setIsConfigOpen(true);

    if (typeof window !== "undefined") {
      const el = document.getElementById("lbp-settings");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <section className="w-full container mx-auto max-w-5xl flex flex-col items-center justify-center py-20 md:py-32 px-4 md:px-6 text-center">
      <h1 className="text-4xl md:text-6xl lg:text-7xl text-foreground tracking-tight mb-6">
        Launch the next disruptive token
      </h1>
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
        Simulate a token sale by LBP pool to understand how Balancer can rocket
        your token launch to success.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          size="lg"
          className="bg-[#E6C8A3] hover:bg-[#E6C8A3]/80 text-[#171717] rounded-full px-8 text-base cursor-pointer"
          onClick={handleGetStartedClick}
        >
          Get started
        </Button>
        <Link href="https://docs.balancer.fi/concepts/explore-available-balancer-pools/liquidity-bootstrapping-pool.html">
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
    </section>
  );
}
