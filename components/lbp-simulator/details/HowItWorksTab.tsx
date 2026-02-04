"use client";

import { Badge } from "@/components/ui/badge";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";

export function HowItWorksTab() {
  const { isPlaying, config } = useSimulatorStore(
    useShallow((state) => ({
      isPlaying: state.isPlaying,
      config: state.config,
    })),
  );

  const steps = [
    {
      number: "01",
      title: "Create LBP pool",
      description: "Set parameters and release the LBP on market.",
    },
    {
      number: "02",
      title: "Price discovery",
      description: "Market will trade the project token against the collateral choice, until a fair price is discovered.",
    },
    {
      number: "03",
      title: "Claim funds",
      description: `Claim ${config.tokenSymbol} and raise funds.`,
    },
  ];

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {steps.map((step, index) => (
        <div
          key={index}
          className="bg-muted rounded-lg p-6 shadow-sm border border-border/50"
        >
          <Badge
            variant="outline"
            className={
              isPlaying
                ? "mb-4 bg-gradient-to-r from-blue-300 via-purple-300 to-orange-300 hover:from-blue-400 hover:via-purple-400 hover:to-orange-400 text-slate-900 border-0 font-semibold"
                : "mb-4"
            }
          >
            {step.number}
          </Badge>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </div>
      ))}
    </div>
    <div className="mt-8 bg-card rounded-lg p-6 shadow-sm border border-border/50">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        How LBP Math Works
      </h3>
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          Liquidity Bootstrapping Pools use <strong className="text-foreground">Weighted Math with time-dependent weights</strong>. 
          The pool starts with high weights for the project token (e.g., 80/20) and linearly shifts to low weights (e.g., 20/80) over the sale period.
        </p>
        <div className="my-4 p-4 bg-muted/50 rounded-lg border border-border/30">
          <div className="text-center font-mono text-base text-foreground">
            <span className="font-semibold">V</span> = <span className="text-lg">Π</span>
            <sub className="text-xs">t</sub> <span className="font-semibold">B</span>
            <sub className="text-xs">t</sub>
            <sup className="text-xs">(<span className="font-semibold">W</span><sub className="text-xs">t</sub>)</sup>
          </div>
          <div className="mt-2 text-xs text-muted-foreground text-center space-y-1">
            <p>where <span className="font-mono font-semibold text-foreground">V</span> = invariant value</p>
            <p><span className="font-mono font-semibold text-foreground">B<sub>t</sub></span> = balance of token t</p>
            <p><span className="font-mono font-semibold text-foreground">W<sub>t</sub></span> = weight of token t</p>
          </div>
        </div>
        <p>
          The price is determined by the constant product formula: <strong className="text-foreground font-mono">Price = (Balance₁ × Weight₂) / (Balance₂ × Weight₁)</strong>
        </p>
        <p>
          As weights shift over time, the price naturally decreases, creating sell pressure on the project token. This mechanism allows the market to discover a fair price through trading activity, rather than setting a fixed price upfront.
        </p>
        <p className="text-xs pt-2 border-t border-border/50">
          Learn more about LBPs on{" "}
          <a
            href="https://docs.balancer.fi/concepts/explore-available-balancer-pools/liquidity-bootstrapping-pool.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline"
          >
            Balancer Documentation
          </a>
        </p>
      </div>
    </div>
    </>

  );
}
