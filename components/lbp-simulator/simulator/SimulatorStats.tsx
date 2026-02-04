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

type StoreState = ReturnType<typeof useSimulatorStore.getState>;

/** Derived values from store state (used by value selectors). */
function getDerived(state: StoreState) {
  const collateralUsd = isEthOrWeth(state.config.collateralToken)
    ? (state.ethPriceUsd ?? 1)
    : 1;
  let currentPrice = 0;
  if (
    state.priceHistory.length > 0 &&
    state.priceHistory[state.currentStep] > 0
  ) {
    currentPrice = state.priceHistory[state.currentStep];
  } else if (
    state.baseSnapshots.length > 0 &&
    state.baseSnapshots[state.currentStep]
  ) {
    currentPrice = state.baseSnapshots[state.currentStep].price;
  } else {
    const staticData =
      state.simulationData[state.currentStep] || state.simulationData[0];
    currentPrice = staticData?.price || 0;
  }
  const startPrice = state.simulationData[0]?.price || 0;
  const tokenPriceUsd = currentPrice * collateralUsd;
  const stepData =
    state.baseSnapshots[state.currentStep] ??
    state.simulationData[state.currentStep] ??
    state.simulationData[0];
  const tknW = stepData?.tknWeight ?? state.config.tknWeightIn;
  const collW = stepData?.usdcWeight ?? state.config.usdcWeightIn;
  const tvlUsd =
    stepData &&
    "tvlUsd" in stepData &&
    typeof stepData.tvlUsd === "number" &&
    !isEthOrWeth(state.config.collateralToken)
      ? stepData.tvlUsd
      : calcTVLUSD(
          state.config,
          state.currentTknBalance,
          state.currentUsdcBalance,
          tknW,
          collW,
          { collateralUsd },
        ).tvlUsd;
  const tokensForSale = state.config.tknBalanceIn;
  const fdv = tokenPriceUsd * state.config.totalSupply;
  const impliedMarketCap = tokenPriceUsd * tokensForSale;
  return {
    collateralUsd,
    currentPrice,
    startPrice,
    tokenPriceUsd,
    tvlUsd,
    tokensForSale,
    fdv,
    impliedMarketCap,
  };
}

type ValueSelector = (state: StoreState) => string;

const STAT_VALUE_SELECTORS: ValueSelector[] = [
  (state) => {
    const tokensForSale = state.config.tknBalanceIn;
    return `${(tokensForSale / 1_000_000).toFixed(1)}M ${state.config.tokenSymbol}`;
  },
  (state) => {
    const d = getDerived(state);
    return `$${(d.impliedMarketCap / 1_000_000).toFixed(2)}M`;
  },
  (state) => {
    const d = getDerived(state);
    return `$${(d.startPrice * d.collateralUsd).toFixed(2)}`;
  },
  (state) => {
    const d = getDerived(state);
    return `$${d.tokenPriceUsd.toFixed(2)}`;
  },
  (state) => {
    const d = getDerived(state);
    return `$${(d.fdv / 1_000_000).toFixed(2)}M`;
  },
  (state) => {
    const d = getDerived(state);
    return `$${(d.tvlUsd / 1_000_000).toFixed(2)}M`;
  },
];

/** Subscribes to store with a selector; only this (the value) re-renders when value changes. */
const StatValue = memo(function StatValue({
  selector,
}: {
  selector: ValueSelector;
}) {
  const value = useSimulatorStore(selector);
  return <>{value}</>;
});

const STAT_META = [
  {
    label: "Tokens for sale",
    description:
      "The total number of tokens available for purchase in this Liquidity Bootstrapping Pool (LBP). This represents the portion of the total token supply that the project is selling during the LBP period.",
  },
  {
    label: "Implied Market Cap",
    description:
      "The market cap implied by the sale: current token price × tokens for sale. Represents the valuation of the portion of supply being sold in the LBP at the current price.",
  },
  {
    label: "Starting price",
    description:
      "The initial price of the token when the LBP begins (in USD). LBPs typically start with a high price to prevent front-running and allow fair price discovery as the pool weights shift over time.",
  },
  {
    label: "Current price",
    description:
      "The current spot price of the token in the LBP in USD, calculated based on the current pool balances and weights. This price updates in real-time as trades occur and pool weights shift.",
  },
  {
    label: "FDV",
    description:
      "Fully diluted valuation: total token supply × current price. The valuation if all tokens were valued at the current LBP spot price.",
  },
  {
    label: "TVL",
    description:
      "Total value locked in the pool: collateral balance (e.g. USDC) plus token balance valued at current spot price in collateral.",
  },
] as const;

function SimulatorStatsComponent() {
  const { config, ethPriceUsd, fetchEthPrice } = useSimulatorStore(
    useShallow((state) => ({
      config: state.config,
      ethPriceUsd: state.ethPriceUsd,
      fetchEthPrice: state.fetchEthPrice,
    })),
  );

  useEffect(() => {
    if (isEthOrWeth(config.collateralToken) && ethPriceUsd === null) {
      fetchEthPrice();
    }
  }, [config.collateralToken, ethPriceUsd, fetchEthPrice]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 md:grid-cols-4 sm:grid-cols-2 gap-4 mb-6">
      {STAT_META.map((meta, i) => (
        <StatCard
          key={meta.label}
          label={meta.label}
          description={meta.description}
        >
          <StatValue selector={STAT_VALUE_SELECTORS[i]} />
        </StatCard>
      ))}
    </div>
  );
}

export const SimulatorStats = memo(SimulatorStatsComponent);
