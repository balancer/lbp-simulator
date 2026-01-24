"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { calculateOutGivenIn } from "@/lib/lbp-math";
import { ArrowUpDown, Wallet } from "lucide-react";
import { toast } from "@/components/ui/toast";

type SwapDirection = "buy" | "sell"; // buy = USDC -> Token, sell = Token -> USDC

export function BidForm() {
  const {
    config,
    currentStep,
    simulationData,
    currentTknBalance,
    currentUsdcBalance,
    processBuy,
    processSell,
  } = useSimulatorStore();

  const [direction, setDirection] = useState<SwapDirection>("buy");
  const [inputAmount, setInputAmount] = useState<string>("");
  
  // Get user wallet balances from store
  const { userTknBalance, userUsdcBalance } = useSimulatorStore();

  // Get current step data for calculations
  const stepData = simulationData[currentStep] || simulationData[0];
  const currentPrice = stepData?.price || 0;

  // Calculate output amount based on input
  const outputAmount = useMemo(() => {
    if (!inputAmount || !stepData || parseFloat(inputAmount) <= 0) return 0;

    const amount = parseFloat(inputAmount);
    if (direction === "buy") {
      // Buying token with USDC
      return calculateOutGivenIn(
        currentUsdcBalance,
        stepData.usdcWeight,
        currentTknBalance,
        stepData.tknWeight,
        amount,
      );
    } else {
      // Selling token for USDC
      return calculateOutGivenIn(
        currentTknBalance,
        stepData.tknWeight,
        currentUsdcBalance,
        stepData.usdcWeight,
        amount,
      );
    }
  }, [inputAmount, direction, stepData, currentTknBalance, currentUsdcBalance]);

  // Calculate USD values
  const inputUsdValue = useMemo(() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) return 0;
    const amount = parseFloat(inputAmount);
    return direction === "buy" ? amount : amount * currentPrice;
  }, [inputAmount, direction, currentPrice]);

  const outputUsdValue = useMemo(() => {
    if (outputAmount <= 0) return 0;
    return direction === "buy" ? outputAmount * currentPrice : outputAmount;
  }, [outputAmount, direction, currentPrice]);

  const handleSwap = () => {
    setDirection(direction === "buy" ? "sell" : "buy");
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
    if (direction === "buy") {
      if (amount > userUsdcBalance) {
        alert(`Insufficient USDC balance. You have ${userUsdcBalance.toLocaleString()} USDC.`);
        return;
      }
      
      // Calculate output before processing (for toast)
      const amountOut = calculateOutGivenIn(
        currentUsdcBalance,
        stepData.usdcWeight,
        currentTknBalance,
        stepData.tknWeight,
        amount,
      );
      
      processBuy(amount);
      
      // Show toast notification
      toast({
        title: `Bought ${config.tokenSymbol}`,
        description: `You bought ${amountOut.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${config.tokenSymbol} for ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`,
        duration: 5000,
      });
    } else {
      if (amount > userTknBalance) {
        alert(`Insufficient ${config.tokenSymbol} balance. You have ${userTknBalance.toLocaleString()} ${config.tokenSymbol}.`);
        return;
      }
      
      // Calculate output before processing (for toast)
      const amountOut = calculateOutGivenIn(
        currentTknBalance,
        stepData.tknWeight,
        currentUsdcBalance,
        stepData.usdcWeight,
        amount,
      );
      
      processSell(amount);
      
      // Show toast notification
      toast({
        title: `Sold ${config.tokenSymbol}`,
        description: `You sold ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${config.tokenSymbol} for ${amountOut.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`,
        duration: 5000,
      });
    }
    setInputAmount("");
  };

  const isValidAmount = inputAmount && parseFloat(inputAmount) > 0;
  const hasInsufficientBalance = isValidAmount && (
    (direction === "buy" && parseFloat(inputAmount) > userUsdcBalance) ||
    (direction === "sell" && parseFloat(inputAmount) > userTknBalance)
  );

  const inputToken = direction === "buy" ? "USDC" : config.tokenSymbol;
  const outputToken = direction === "buy" ? config.tokenSymbol : "USDC";
  const inputBalance = direction === "buy" ? userUsdcBalance : userTknBalance;
  const outputBalance = direction === "buy" ? userTknBalance : userUsdcBalance;

  return (
    <Card className="h-[600px] border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Swap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">You pay</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Wallet className="h-3 w-3" />
              <span>{inputBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
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
              <div className="text-sm text-muted-foreground mt-1">
                ${inputUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            <Button
              variant="outline"
              className="flex items-center gap-2 px-3 py-2 h-auto"
            >
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                {inputToken === "USDC" ? "U" : config.tokenSymbol[0]}
              </div>
              <span className="font-medium">{inputToken}</span>
              <svg
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
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
              <span>{outputBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-4 border border-border rounded-lg bg-background">
            <div className="flex-1">
              <div className="text-2xl font-semibold">
                {outputAmount > 0
                  ? outputAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })
                  : "0.00"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                ${outputUsdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            <Button
              variant="outline"
              className="flex items-center gap-2 px-3 py-2 h-auto bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200 hover:from-blue-300 hover:via-purple-300 hover:to-orange-300 text-slate-900 border-0"
            >
              <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">
                {outputToken === "USDC" ? "U" : config.tokenSymbol[0]}
              </div>
              <span className="font-medium">{outputToken}</span>
              <svg
                className="h-4 w-4 text-slate-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </Button>
          </div>
        </div>

        {/* Price Info */}
        <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Price:</span>
            <span className="font-medium text-foreground">
              ${currentPrice.toFixed(4)} {config.tokenSymbol}/USDC
            </span>
          </div>
        </div>

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
          {direction === "buy" ? `Buy ${config.tokenSymbol}` : `Sell ${config.tokenSymbol}`}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          This transaction is simulated and will not cost real tokens.
        </p>
      </CardContent>
    </Card>
  );
}
