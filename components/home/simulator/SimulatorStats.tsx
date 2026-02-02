"use client";

import { useSimulatorStore } from "@/store/useSimulatorStore";
import { StatCard } from "./StatCard";
import { useShallow } from "zustand/react/shallow";
import { memo, useEffect } from "react";
import { calcTVLUSD } from "@/lib/lbp-math";

function isEthOrWeth(
  token: string,
): token is "ETH" | "wETH" {
  return token === "ETH" || token === "wETH";
}

function SimulatorStatsComponent() {
  const {
    config,
    currentStep,
    currentTknBalance,
    currentUsdcBalance,
    simulationData,
    baseSnapshots,
    priceHistory,
    ethPriceUsd,
    fetchEthPrice,
  } = useSimulatorStore(
    useShallow((state) => ({
      config: state.config,
      currentStep: state.currentStep,
      currentTknBalance: state.currentTknBalance,
      currentUsdcBalance: state.currentUsdcBalance,
      simulationData: state.simulationData,
      baseSnapshots: state.baseSnapshots,
      priceHistory: state.priceHistory,
      ethPriceUsd: state.ethPriceUsd,
      fetchEthPrice: state.fetchEthPrice,
    })),
  );

  const collateralUsd =
    isEthOrWeth(config.collateralToken) ? (ethPriceUsd ?? 1) : 1;

  useEffect(() => {
    if (isEthOrWeth(config.collateralToken) && ethPriceUsd === null) {
      fetchEthPrice();
    }
  }, [config.collateralToken, ethPriceUsd, fetchEthPrice]);

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
  const tokenPriceUsd = currentPrice * collateralUsd;
  const fdv = tokenPriceUsd * config.totalSupply;
  const impliedMarketCap = tokenPriceUsd * tokensForSale;

  const stepData = baseSnapshots[currentStep] ?? simulationData[currentStep] ?? simulationData[0];
  const tknW = stepData?.tknWeight ?? config.tknWeightIn;
  const collW = stepData?.usdcWeight ?? config.usdcWeightIn;
  const tvlUsd =
    stepData &&
    "tvlUsd" in stepData &&
    typeof stepData.tvlUsd === "number" &&
    !isEthOrWeth(config.collateralToken)
      ? stepData.tvlUsd
      : calcTVLUSD(config, currentTknBalance, currentUsdcBalance, tknW, collW, {
          collateralUsd,
        }).tvlUsd;

  const stats = [
    {
      label: "Tokens for sale",
      value: `${(tokensForSale / 1_000_000).toFixed(1)}M ${config.tokenSymbol}`,
      description:
        "The total number of tokens available for purchase in this Liquidity Bootstrapping Pool (LBP). This represents the portion of the total token supply that the project is selling during the LBP period.",
    },
    {
      label: "Implied Market Cap",
      value: `$${((impliedMarketCap)/ 1_000_000).toFixed(2)}M`,
      description:
        "The market cap implied by the sale: current token price × tokens for sale. Represents the valuation of the portion of supply being sold in the LBP at the current price.",
    },
    {
      label: "Starting price",
      value: `$${(startPrice * collateralUsd).toFixed(4)}`,
      description:
        "The initial price of the token when the LBP begins (in USD). LBPs typically start with a high price to prevent front-running and allow fair price discovery as the pool weights shift over time.",
    },
    {
      label: "Current price",
      value: `$${tokenPriceUsd.toFixed(4)}`,
      description:
        "The current spot price of the token in the LBP in USD, calculated based on the current pool balances and weights. This price updates in real-time as trades occur and pool weights shift.",
    },
    {
      label: "FDV",
      value: `$${(fdv/1_000_000).toFixed(2)}M`,
      description:
        "Fully diluted valuation: total token supply × current price. The valuation if all tokens were valued at the current LBP spot price.",
    },
    {
      label: "TVL",
      value: `$${(tvlUsd / 1_000_000).toFixed(2)}M`,
      description:
        "Total value locked in the pool: collateral balance (e.g. USDC) plus token balance valued at current spot price in collateral.",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
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
