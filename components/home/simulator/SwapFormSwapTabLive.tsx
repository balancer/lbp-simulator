"use client";

import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";
import { useMemo, memo } from "react";
import { calculateOutGivenIn } from "@/lib/lbp-math";
import type { LBPConfig } from "@/lib/lbp-math";

type SwapDirection = "buy" | "sell";

/**
 * Subscribes only to step-changing store state. Renders output amount, USD values, and price.
 * Buttons/inputs live in the parent so they don't re-render every step.
 */
function SwapFormSwapTabLiveComponent({
  inputAmount,
  direction,
  config,
  part,
}: {
  inputAmount: string;
  direction: SwapDirection;
  config: LBPConfig;
  part: "inputUsd" | "output" | "price";
}) {
  const {
    currentStep,
    simulationData,
    baseSnapshots,
    priceHistory,
    currentTknBalance,
    currentUsdcBalance,
  } = useSimulatorStore(
    useShallow((state) => ({
      currentStep: state.currentStep,
      simulationData: state.simulationData,
      baseSnapshots: state.baseSnapshots,
      priceHistory: state.priceHistory,
      currentTknBalance: state.currentTknBalance,
      currentUsdcBalance: state.currentUsdcBalance,
    })),
  );

  const stepData = baseSnapshots.length > 0 && baseSnapshots[currentStep]
    ? baseSnapshots[currentStep]
    : simulationData[currentStep] || simulationData[0];

  const currentPrice = baseSnapshots.length > 0 && baseSnapshots[currentStep]
    ? baseSnapshots[currentStep].price
    : priceHistory.length > 0 && priceHistory[currentStep] > 0
    ? priceHistory[currentStep]
    : stepData?.price || 0;

  const outputAmount = useMemo(() => {
    if (!inputAmount || !stepData || parseFloat(inputAmount) <= 0) return 0;
    const amount = parseFloat(inputAmount);
    if (direction === "buy") {
      return calculateOutGivenIn(
        currentUsdcBalance,
        stepData.usdcWeight,
        currentTknBalance,
        stepData.tknWeight,
        amount,
      );
    }
    return calculateOutGivenIn(
      currentTknBalance,
      stepData.tknWeight,
      currentUsdcBalance,
      stepData.usdcWeight,
      amount,
    );
  }, [inputAmount, direction, stepData, currentTknBalance, currentUsdcBalance]);

  const inputUsdValue = useMemo(() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) return 0;
    const amount = parseFloat(inputAmount);
    return direction === "buy" ? amount : amount * currentPrice;
  }, [inputAmount, direction, currentPrice]);

  const outputUsdValue = useMemo(() => {
    if (outputAmount <= 0) return 0;
    return direction === "buy" ? outputAmount * currentPrice : outputAmount;
  }, [outputAmount, direction, currentPrice]);

  if (part === "inputUsd") {
    return (
      <div className="text-sm text-muted-foreground mt-1">
        ${inputUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
    );
  }

  if (part === "output") {
    return (
      <>
        <div className="text-2xl font-semibold">
          {outputAmount > 0
            ? outputAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })
            : "0.00"}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          ${outputUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      </>
    );
  }

  // part === "price"
  return (
    <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
      <div className="flex justify-between">
        <span>Price:</span>
        <span className="font-medium text-foreground">
          ${currentPrice.toFixed(4)} {config.tokenSymbol}/{config.collateralToken}
        </span>
      </div>
    </div>
  );
}

export const SwapFormSwapTabLive = memo(SwapFormSwapTabLiveComponent);
