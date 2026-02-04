"use client";

import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";
import { useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import type { LBPConfig } from "@/lib/lbp-math";

/**
 * Subscribes only to step-changing state (currentPrice) and userUsdcBalance.
 * Renders one of: current price span, est. tokens per part, error, or Create button.
 */
function SwapFormTWAPTabLiveComponent({
  part,
  amount,
  parts,
  duration,
  protection,
  spendPerPart,
  config,
  createTwapOrder,
}: {
  part: "currentPrice" | "estBuyPerPart" | "error" | "button";
  amount: number;
  parts: number;
  duration: number;
  protection: number;
  spendPerPart: number;
  config: LBPConfig;
  createTwapOrder: (order: {
    type: "buy";
    totalCollateral: number;
    numParts: number;
    totalDurationHours: number;
    priceProtectionPct: number;
  }) => void;
}) {
  const { currentStep, baseSnapshots, priceHistory, simulationData, userUsdcBalance } =
    useSimulatorStore(
      useShallow((state) => ({
        currentStep: state.currentStep,
        baseSnapshots: state.baseSnapshots,
        priceHistory: state.priceHistory,
        simulationData: state.simulationData,
        userUsdcBalance: state.userUsdcBalance,
      })),
    );

  const currentPrice = baseSnapshots.length > 0 && baseSnapshots[currentStep]
    ? baseSnapshots[currentStep].price
    : priceHistory.length > 0 && priceHistory[currentStep] > 0
    ? priceHistory[currentStep]
    : (simulationData[currentStep] || simulationData[0])?.price || 0;

  const estTokensPerPart = useMemo(
    () => (spendPerPart > 0 && currentPrice > 0 ? spendPerPart / currentPrice : 0),
    [spendPerPart, currentPrice],
  );

  const isValid =
    amount > 0 && parts >= 1 && duration > 0 && currentPrice > 0;
  const hasInsufficientBalance = isValid && amount > userUsdcBalance;

  const handleCreate = () => {
    if (!isValid || hasInsufficientBalance) return;
    createTwapOrder({
      type: "buy",
      totalCollateral: amount,
      numParts: parts,
      totalDurationHours: duration,
      priceProtectionPct: protection,
    });
  };

  if (part === "currentPrice") {
    return (
      <span className="ml-auto text-xs text-muted-foreground">
        Current price: {currentPrice.toFixed(4)} {config.collateralToken} /{" "}
        {config.tokenSymbol}
      </span>
    );
  }

  if (part === "estBuyPerPart") {
    return (
      <div className="space-y-1 p-3 bg-muted/30 rounded-lg col-span-2">
        <div className="font-medium text-foreground text-xs">
          Est. buy per part
        </div>
        <div>
          {estTokensPerPart.toLocaleString(undefined, {
            maximumFractionDigits: 4,
          })}{" "}
          {config.tokenSymbol} @ ~
          {currentPrice.toFixed(4)} {config.collateralToken}
        </div>
      </div>
    );
  }

  if (part === "error") {
    if (!hasInsufficientBalance) return null;
    return (
      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
        Insufficient balance to schedule this TWAP.
      </div>
    );
  }

  // part === "button"
  return (
    <Button
      onClick={handleCreate}
      disabled={!isValid || hasInsufficientBalance}
      className="w-full bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200 hover:from-blue-300 hover:via-purple-300 hover:to-orange-300 text-slate-900 font-semibold rounded-xl px-6 h-11 disabled:opacity-50 disabled:cursor-not-allowed"
      size="lg"
    >
      Start TWAP program
    </Button>
  );
}

export const SwapFormTWAPTabLive = memo(SwapFormTWAPTabLiveComponent);
