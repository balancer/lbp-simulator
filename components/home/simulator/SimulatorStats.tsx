"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useSimulatorStore } from "@/store/useSimulatorStore";

export function SimulatorStats() {
  const { config, currentStep, simulationData } = useSimulatorStore();

  // Safe access to current data
  const currentData = simulationData[currentStep] || simulationData[0];

  // Use config or live data
  const tokensForSale = config.tknBalanceIn; // Simplified logic vs %
  const currentPrice = currentData?.price || 0;
  const impliedMarketCap = currentData?.marketCap || 0;
  const startPrice = simulationData[0]?.price || 0;

  const stats = [
    {
      label: "Tokens for sale",
      value: `${(tokensForSale / 1_000_000).toFixed(1)}M ${config.tokenSymbol}`,
    },
    {
      label: "Implied Market Cap",
      value: `$${(impliedMarketCap / 1_000_000).toFixed(2)}M`,
    },
    {
      label: "Starting price",
      value: `$${startPrice.toFixed(4)}`,
    },
    {
      label: "Current price",
      value: `$${currentPrice.toFixed(4)}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, i) => (
        <Card key={i} className="shadow-sm border-border/60">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {stat.label}
            </span>
            <span className="text-lg md:text-xl font-semibold tracking-tight">
              {stat.value}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
