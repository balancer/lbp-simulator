"use client";

import { useMemo, useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

function SwapFormLimitTabComponent() {
  const {
    config,
    userUsdcBalance,
    limitOrders,
    createLimitOrder,
    cancelLimitOrder,
  } = useSimulatorStore(
    useShallow((state) => ({
      config: state.config,
      userUsdcBalance: state.userUsdcBalance,
      limitOrders: state.limitOrders,
      createLimitOrder: state.createLimitOrder,
      cancelLimitOrder: state.cancelLimitOrder,
    })),
  );

  const [triggerPrice, setTriggerPrice] = useState<string>("");
  const [collateralAmount, setCollateralAmount] = useState<string>("");

  const estimatedTokens = useMemo(() => {
    const price = parseFloat(triggerPrice);
    const amount = parseFloat(collateralAmount);
    if (!price || !amount || price <= 0 || amount <= 0) return 0;
    return amount / price;
  }, [triggerPrice, collateralAmount]);

  const isValid =
    !!triggerPrice &&
    !!collateralAmount &&
    parseFloat(triggerPrice) > 0 &&
    parseFloat(collateralAmount) > 0;

  const hasInsufficientBalance =
    isValid && parseFloat(collateralAmount) > userUsdcBalance;

  const handleMax = () => {
    setCollateralAmount(userUsdcBalance.toString());
  };

  const handleCreateOrder = () => {
    if (!isValid || hasInsufficientBalance) return;
    const price = parseFloat(triggerPrice);
    const amount = parseFloat(collateralAmount);

    createLimitOrder({
      type: "buy",
      triggerPrice: price,
      collateralAmount: amount,
    });

    setTriggerPrice("");
    setCollateralAmount("");
  };

  const openOrders = limitOrders.filter((o) => o.status === "open");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          When the price reaches your target, a simulated market order will be
          sent using your wallet balance.
        </div>
      </div>

      {/* Trigger price */}
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">
          When 1 {config.tokenSymbol} is worth
        </span>
        <div className="flex items-center gap-2 p-4 border border-border rounded-lg bg-background">
          <Input
            type="number"
            placeholder="0.00"
            value={triggerPrice}
            onChange={(e) => setTriggerPrice(e.target.value)}
            className="text-2xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent dark:bg-transparent shadow-none"
          />
          <span className="text-sm font-medium text-muted-foreground">
            {config.collateralToken}
          </span>
        </div>
      </div>

      {/* Amount to spend */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Spend at most
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>
              Balance:{" "}
              {userUsdcBalance.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{" "}
              {config.collateralToken}
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
          <Input
            type="number"
            placeholder="0.00"
            value={collateralAmount}
            onChange={(e) => setCollateralAmount(e.target.value)}
            className="text-2xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent dark:bg-transparent shadow-none"
          />
          <span className="text-sm font-medium text-muted-foreground">
            {config.collateralToken}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground space-y-1">
        <div>
          When price ≤{" "}
          <span className="font-medium">
            {triggerPrice || "0.00"} {config.collateralToken}
          </span>{" "}
          per {config.tokenSymbol},
        </div>
        <div>
          buy up to{" "}
          <span className="font-medium">
            {estimatedTokens.toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })}{" "}
            {config.tokenSymbol}
          </span>{" "}
          spending{" "}
          <span className="font-medium">
            {collateralAmount || "0.00"} {config.collateralToken}
          </span>
          .
        </div>
      </div>

      {hasInsufficientBalance && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
          Insufficient balance to place this order.
        </div>
      )}

      <Button
        onClick={handleCreateOrder}
        disabled={!isValid || hasInsufficientBalance}
        className="w-full bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200 hover:from-blue-300 hover:via-purple-300 hover:to-orange-300 text-slate-900 font-semibold rounded-xl px-6 h-11 disabled:opacity-50 disabled:cursor-not-allowed"
        size="lg"
      >
        Place limit order
      </Button>

      {/* Open orders list */}
      {openOrders.length > 0 && (
        <Collapsible className="space-y-2 pt-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            >
              <span>Open limit orders</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-foreground/70">
                {openOrders.length}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 max-h-40 overflow-y-auto mt-1.5">
              {openOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-2 border border-border/60 rounded-md text-xs bg-background/60"
                >
                  <div className="space-y-0.5">
                    <div>
                      Buy up to{" "}
                      <span className="font-medium">
                        {(order.collateralAmount / order.triggerPrice).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 4 },
                        )}{" "}
                        {config.tokenSymbol}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      When price ≤{" "}
                      <span className="font-medium">
                        {order.triggerPrice.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}{" "}
                        {config.collateralToken}
                      </span>
                      , spend up to{" "}
                      <span className="font-medium">
                        {order.collateralAmount.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {config.collateralToken}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => cancelLimitOrder(order.id)}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export const SwapFormLimitTab = memo(SwapFormLimitTabComponent);
