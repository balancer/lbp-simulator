"use client";

import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";
import { calculateOutGivenIn } from "@/lib/lbp-math";
import { ArrowUpDown, Wallet } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { TokenLogo } from "@/components/ui/TokenLogo";
import { SwapFormSwapTabLive } from "./SwapFormSwapTabLive";
import Image from "next/image";

type SwapDirection = "buy" | "sell";

function SwapFormSwapTabComponent() {
  const { config, processBuy, processSell, userTknBalance, userUsdcBalance } =
    useSimulatorStore(
      useShallow((state) => ({
        config: state.config,
        processBuy: state.processBuy,
        processSell: state.processSell,
        userTknBalance: state.userTknBalance,
        userUsdcBalance: state.userUsdcBalance,
      })),
    );

  const [direction, setDirection] = useState<SwapDirection>("buy");
  const [inputAmount, setInputAmount] = useState<string>("");

  const handleSwap = () => {
    setDirection((d) => (d === "buy" ? "sell" : "buy"));
    setInputAmount("");
  };

  const handleMax = () => {
    if (direction === "buy") {
      setInputAmount(userUsdcBalance.toString());
    } else {
      setInputAmount(userTknBalance.toString());
    }
  };

  const handleSubmit = () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) return;

    const amount = parseFloat(inputAmount);
    const state = useSimulatorStore.getState();
    const {
      currentStep,
      baseSnapshots,
      simulationData,
      currentTknBalance,
      currentUsdcBalance,
    } = state;

    const stepData =
      baseSnapshots.length > 0 && baseSnapshots[currentStep]
        ? baseSnapshots[currentStep]
        : simulationData[currentStep] || simulationData[0];

    if (direction === "buy") {
      if (amount > userUsdcBalance) {
        alert(
          `Insufficient ${config.collateralToken} balance. You have ${userUsdcBalance.toLocaleString()} ${config.collateralToken}.`,
        );
        return;
      }
      const amountOut = stepData
        ? calculateOutGivenIn(
            currentUsdcBalance,
            stepData.usdcWeight,
            currentTknBalance,
            stepData.tknWeight,
            amount,
          )
        : 0;
      processBuy(amount);
      toast({
        title: `Bought ${config.tokenSymbol}`,
        description: `You bought ${amountOut.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${config.tokenSymbol} for ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${config.collateralToken}`,
        duration: 5000,
      });
    } else {
      if (amount > userTknBalance) {
        alert(
          `Insufficient ${config.tokenSymbol} balance. You have ${userTknBalance.toLocaleString()} ${config.tokenSymbol}.`,
        );
        return;
      }
      const amountOut = stepData
        ? calculateOutGivenIn(
            currentTknBalance,
            stepData.tknWeight,
            currentUsdcBalance,
            stepData.usdcWeight,
            amount,
          )
        : 0;
      processSell(amount);
      toast({
        title: `Sold ${config.tokenSymbol}`,
        description: `You sold ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${config.tokenSymbol} for ${amountOut.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${config.collateralToken}`,
        duration: 5000,
      });
    }
    setInputAmount("");
  };

  const isValidAmount = Boolean(inputAmount && parseFloat(inputAmount) > 0);
  const hasInsufficientBalance = isValidAmount
    ? (direction === "buy" && parseFloat(inputAmount) > userUsdcBalance) ||
      (direction === "sell" && parseFloat(inputAmount) > userTknBalance)
    : false;

  const inputToken =
    direction === "buy" ? config.collateralToken : config.tokenSymbol;
  const outputToken =
    direction === "buy" ? config.tokenSymbol : config.collateralToken;
  const inputBalance = direction === "buy" ? userUsdcBalance : userTknBalance;
  const outputBalance = direction === "buy" ? userTknBalance : userUsdcBalance;

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">You pay</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Wallet className="h-3 w-3" />
            <span>
              {inputBalance.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
            <Button
              variant="link"
              onClick={handleMax}
              className="text-indigo-600 hover:text-indigo-700 font-medium ml-1 h-auto p-0 text-xs min-w-0"
            >
              Max
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 p-4 border border-border rounded-lg bg-background">
          <div className="flex-1">
            <Input
              type="number"
              placeholder="0.00"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="text-2xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent dark:bg-transparent shadow-none"
            />
            <SwapFormSwapTabLive
              inputAmount={inputAmount}
              direction={direction}
              config={config}
              part="inputUsd"
            />
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2 px-3 py-2 h-auto"
          >
            <TokenLogo token={inputToken} size={24} />
            <span className="font-medium">{inputToken}</span>
          </Button>
        </div>
      </div>

      {/* Swap Button */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-10 w-10 bg-background border-border hover:bg-muted"
            onClick={handleSwap}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Output Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">You receive</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Wallet className="h-3 w-3" />
            <span>
              {outputBalance.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-4 border border-border rounded-lg bg-background">
          <div className="flex-1">
            <SwapFormSwapTabLive
              inputAmount={inputAmount}
              direction={direction}
              config={config}
              part="output"
            />
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2 px-3 py-2 h-auto bg-gradient-to-r from-blue-300 via-purple-300 to-orange-300 hover:from-blue-400 hover:via-purple-400 hover:to-orange-400 text-slate-900 border-0"
          >
            <div className="h-6 w-6 bg-white rounded-full flex items-center justify-center font-bold">
              <Image
                src={"logo-balancer-black.svg"}
                alt="Balancer Logo"
                width={16}
                height={16}
              />
            </div>
            <span className="font-medium">{outputToken}</span>
          </Button>
        </div>
      </div>

      {/* Price Info - live component so only this line re-renders every step */}
      <SwapFormSwapTabLive
        inputAmount={inputAmount}
        direction={direction}
        config={config}
        part="price"
      />

      {/* Error Message */}
      {hasInsufficientBalance && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
          Insufficient balance for this transaction.
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={!isValidAmount || hasInsufficientBalance}
        className="w-full bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200 hover:from-blue-300 hover:via-purple-300 hover:to-orange-300 text-slate-900 font-semibold rounded-xl px-6 h-11 disabled:opacity-50 disabled:cursor-not-allowed"
        size="lg"
      >
        {direction === "buy"
          ? `Buy ${config.tokenSymbol}`
          : `Sell ${config.tokenSymbol}`}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        This transaction is simulated and will not cost real tokens.
      </p>
    </div>
  );
}

export const SwapFormSwapTab = memo(SwapFormSwapTabComponent);
