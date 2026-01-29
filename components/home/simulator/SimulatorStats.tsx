"use client";

import { useSimulatorStore } from "@/store/useSimulatorStore";
import { StatCard } from "./StatCard";
import { useShallow } from "zustand/react/shallow";
import { memo } from "react";

function SimulatorStatsComponent() {
  const { config, currentStep, simulationData, baseSnapshots, priceHistory } = useSimulatorStore(
    useShallow((state) => ({
      config: state.config,
      currentStep: state.currentStep,
      simulationData: state.simulationData,
      baseSnapshots: state.baseSnapshots,
      priceHistory: state.priceHistory,
    })),
  );

  // Get current price from live simulation data (baseSnapshots or priceHistory)
  // Fall back to static simulationData if worker hasn't computed yet
  const getCurrentPrice = () => {
    if (baseSnapshots.length > 0 && baseSnapshots[currentStep]) {
      return baseSnapshots[currentStep].price;
    }
    if (priceHistory.length > 0 && priceHistory[currentStep] > 0) {
      return priceHistory[currentStep];
    }
    const staticData = simulationData[currentStep] || simulationData[0];
    return staticData?.price || 0;
  };

  const currentPrice = getCurrentPrice();
  const startPrice = simulationData[0]?.price || 0;
  const tokensForSale = config.tknBalanceIn;
  const impliedMarketCap = currentPrice * config.totalSupply;

  const stats = [
    {
      label: "Tokens for sale",
      value: `${(tokensForSale / 1_000_000).toFixed(1)}M ${config.tokenSymbol}`,
      description:
        "The total number of tokens available for purchase in this Liquidity Bootstrapping Pool (LBP). This represents the portion of the total token supply that the project is selling during the LBP period.",
    },
    {
      label: "Implied Market Cap",
      value: `$${(impliedMarketCap / 1_000_000).toFixed(2)}M`,
      description:
        "The theoretical market capitalization calculated by multiplying the current token price by the total token supply. This gives an estimate of the project's valuation based on the current LBP price.",
    },
    {
      label: "Starting price",
      value: `$${startPrice.toFixed(4)}`,
      description:
        "The initial price of the token when the LBP begins. LBPs typically start with a high price to prevent front-running and allow fair price discovery as the pool weights shift over time.",
    },
    {
      label: "Current price",
      value: `$${currentPrice.toFixed(4)}`,
      description:
        "The current spot price of the token in the LBP, calculated based on the current pool balances and weights. This price updates in real-time as trades occur and pool weights shift.",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, i) => (
        <StatCard
          key={i}
          label={stat.label}
          value={stat.value}
          description={stat.description}
        />
      ))}
    </div>
  );
}

export const SimulatorStats = memo(SimulatorStatsComponent);
