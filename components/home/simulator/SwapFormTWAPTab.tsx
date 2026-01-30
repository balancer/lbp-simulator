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
import { SwapFormTWAPTabLive } from "./SwapFormTWAPTabLive";

function SwapFormTWAPTabComponent() {
  const {
    config,
    userUsdcBalance,
    twapOrders,
    createTwapOrder,
    cancelTwapOrder,
  } = useSimulatorStore(
    useShallow((state) => ({
      config: state.config,
      userUsdcBalance: state.userUsdcBalance,
      twapOrders: state.twapOrders,
      createTwapOrder: state.createTwapOrder,
      cancelTwapOrder: state.cancelTwapOrder,
    })),
  );

  const [totalAmount, setTotalAmount] = useState<string>("");
  const [numParts, setNumParts] = useState<string>("3");
  const [totalDurationDays, setTotalDurationDays] = useState<string>("1");
  const [priceProtectionPct, setPriceProtectionPct] = useState<string>("0");

  const parsed = useMemo(() => {
    const amount = parseFloat(totalAmount);
    const parts = Math.max(1, Math.floor(parseFloat(numParts) || 0));
    const durationDays = Math.max(0.04, parseFloat(totalDurationDays) || 0); // min ~1h as days
    const duration = durationDays * 24; // hours
    const protection = Math.max(
      0,
      Math.min(50, parseFloat(priceProtectionPct) || 0),
    );
    const spendPerPart = amount > 0 && parts > 0 ? amount / parts : 0;
    const partDurationHours = duration / parts;
    return {
      amount,
      parts,
      duration,
      protection,
      spendPerPart,
      partDurationHours,
    };
  }, [totalAmount, numParts, totalDurationDays, priceProtectionPct]);

  const handleMax = () => {
    setTotalAmount(userUsdcBalance.toString());
  };

  const handleCreateSuccess = () => {
    setTotalAmount("");
    setPriceProtectionPct("0");
  };

  const openTwapOrders = twapOrders.filter((o) => o.status === "open");

  const formatHours = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    const days = hours / 24;
    return `${days.toFixed(1)}d`;
  };

  const createTwapOrderAndReset = (order: Parameters<typeof createTwapOrder>[0]) => {
    createTwapOrder(order);
    handleCreateSuccess();
  };

  return (
    <div className="space-y-4">
      {/* Amount to TWAP */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            You pay over time
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
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="text-2xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent dark:bg-transparent shadow-none"
          />
          <span className="text-sm font-medium text-muted-foreground">
            {config.collateralToken}
          </span>
        </div>
      </div>

      {/* Price protection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Price protection
          </span>
          <span className="text-xs text-muted-foreground">
            Max +slippage vs now
          </span>
        </div>
        <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-background">
          <Input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={priceProtectionPct}
            onChange={(e) => setPriceProtectionPct(e.target.value)}
            className="w-20 h-8 text-sm font-medium border-0 p-0 focus-visible:ring-0 bg-transparent dark:bg-transparent shadow-none"
          />
          <span className="text-sm font-medium text-muted-foreground">%</span>
          <SwapFormTWAPTabLive
            part="currentPrice"
            amount={parsed.amount}
            parts={parsed.parts}
            duration={parsed.duration}
            protection={parsed.protection}
            spendPerPart={parsed.spendPerPart}
            config={config}
            createTwapOrder={createTwapOrderAndReset}
          />
        </div>
      </div>

      {/* Schedule settings */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">No. of parts</span>
          </div>
          <div className="p-3 border border-border rounded-lg bg-background">
            <Input
              type="number"
              min={1}
              max={50}
              value={numParts}
              onChange={(e) => setNumParts(e.target.value)}
              className="h-8 text-sm font-medium border-0 p-0 focus-visible:ring-0 bg-transparent dark:bg-transparent shadow-none"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">
            Total duration (days)
          </span>
          <div className="p-3 border border-border rounded-lg bg-background">
            <Input
              type="number"
              min={0.04}
              max={config.duration / 24}
              step={0.5}
              value={totalDurationDays}
              onChange={(e) => setTotalDurationDays(e.target.value)}
              className="h-8 text-sm font-medium border-0 p-0 focus-visible:ring-0 bg-transparent dark:bg-transparent shadow-none"
            />
          </div>
        </div>
      </div>

      {/* Per-part summary */}
      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div className="space-y-1 p-3 bg-muted/30 rounded-lg">
          <div className="font-medium text-foreground text-xs">
            Part duration
          </div>
          <div>{formatHours(parsed.partDurationHours)}</div>
        </div>
        <div className="space-y-1 p-3 bg-muted/30 rounded-lg">
          <div className="font-medium text-foreground text-xs">
            Spend per part
          </div>
          <div>
            {parsed.spendPerPart.toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })}{" "}
            {config.collateralToken}
          </div>
        </div>
        <SwapFormTWAPTabLive
          part="estBuyPerPart"
          amount={parsed.amount}
          parts={parsed.parts}
          duration={parsed.duration}
          protection={parsed.protection}
          spendPerPart={parsed.spendPerPart}
          config={config}
          createTwapOrder={createTwapOrderAndReset}
        />
      </div>

      <SwapFormTWAPTabLive
        part="error"
        amount={parsed.amount}
        parts={parsed.parts}
        duration={parsed.duration}
        protection={parsed.protection}
        spendPerPart={parsed.spendPerPart}
        config={config}
        createTwapOrder={createTwapOrderAndReset}
      />

      <SwapFormTWAPTabLive
        part="button"
        amount={parsed.amount}
        parts={parsed.parts}
        duration={parsed.duration}
        protection={parsed.protection}
        spendPerPart={parsed.spendPerPart}
        config={config}
        createTwapOrder={createTwapOrderAndReset}
      />

      {/* Open TWAP programs */}
      {openTwapOrders.length > 0 && (
        <Collapsible className="space-y-2 pt-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
            >
              <span>Active TWAP programs</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-foreground/70">
                {openTwapOrders.length}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 max-h-32 overflow-y-auto mt-1.5 text-xs">
              {openTwapOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-2 border border-border/60 rounded-md bg-background/60"
                >
                  <div className="space-y-0.5">
                    <div>
                      Total:{" "}
                      <span className="font-medium">
                        {order.totalCollateral.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}{" "}
                        {config.collateralToken}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {order.numParts} parts over{" "}
                      {formatHours(order.totalDurationHours)} • Protection{" "}
                      {order.priceProtectionPct.toFixed(1)}%
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => cancelTwapOrder(order.id)}
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

export const SwapFormTWAPTab = memo(SwapFormTWAPTabComponent);
