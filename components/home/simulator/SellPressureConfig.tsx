"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RotateCcw, TrendingUp } from "lucide-react";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import {
  DEFAULT_SELL_PRESSURE_CONFIG,
  getLoyalSellSchedule,
  SellPressureConfig as SellPressureConfigType,
} from "@/lib/lbp-math";
import { Separator } from "@/components/ui/separator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo, useState, useEffect, memo } from "react";
import { useDebounce } from "@/lib/useDebounce";
import { useShallow } from "zustand/react/shallow";

function SellPressureConfigComponent() {
  const { sellPressureConfig, updateSellPressureConfig, config } =
    useSimulatorStore(
      useShallow((state) => ({
        sellPressureConfig: state.sellPressureConfig,
        updateSellPressureConfig: state.updateSellPressureConfig,
        config: state.config,
      })),
    );

  const [localConfig, setLocalConfig] = useState<SellPressureConfigType>(
    sellPressureConfig,
  );

  useEffect(() => {
    setLocalConfig(sellPressureConfig);
  }, [sellPressureConfig]);

  const debouncedConfig = useDebounce(localConfig, 500);

  useEffect(() => {
    const configsEqual =
      JSON.stringify(debouncedConfig) === JSON.stringify(sellPressureConfig);
    if (!configsEqual) {
      updateSellPressureConfig(debouncedConfig);
    }
  }, [debouncedConfig, sellPressureConfig, updateSellPressureConfig]);

  // Preview: for loyal, show cumulative fraction of tokens sold over time.
  // For greedy, we don't plot a deterministic curve because it depends on
  // simulated price vs cost basis; we show an explainer instead.
  const previewData = useMemo(() => {
    if (localConfig.preset === "loyal") {
      const schedule = getLoyalSellSchedule(
        config.duration,
        100,
        localConfig.loyalConcentrationPct,
      );
      let cumulative = 0;
      return schedule.map((w, i) => {
        cumulative += w;
        return {
          time: (i / 100) * config.duration,
          soldPct: cumulative * localConfig.loyalSoldPct,
        };
      });
    }
    return [];
  }, [localConfig, config.duration]);

  const handleReset = () => {
    updateSellPressureConfig(DEFAULT_SELL_PRESSURE_CONFIG);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-full"
          title="Configure Sell Pressure"
        >
          Model the sell pressure
          <TrendingUp className="h-4 w-4 ml-2 rotate-180" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 border-b flex flex-row items-center justify-between space-y-0 shrink-0">
          <DialogTitle className="text-xl font-semibold">
            Sell Pressure Model
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={handleReset}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-8">
            {/* Preview Chart */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Preview
              </h3>
              <div className="h-[250px] border rounded-md p-4 flex items-center justify-center">
                {localConfig.preset === "loyal" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={previewData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        opacity={0.4}
                      />
                      <XAxis
                        dataKey="time"
                        stroke={
                          typeof window !== "undefined" &&
                          document.documentElement.classList.contains("dark")
                            ? "#505050"
                            : "hsl(var(--muted-foreground))"
                        }
                        fontSize={10}
                        tickFormatter={(val) => `${val.toFixed(0)}h`}
                      />
                      <YAxis
                        stroke={
                          typeof window !== "undefined" &&
                          document.documentElement.classList.contains("dark")
                            ? "#505050"
                            : "hsl(var(--muted-foreground))"
                        }
                        fontSize={10}
                        tickFormatter={(val) => `${val.toFixed(0)}%`}
                      />
                      <Tooltip
                        formatter={(value: number | undefined) =>
                          value != null ? `${value.toFixed(2)}%` : ""
                        }
                        labelFormatter={(label) =>
                          `Time: ${Number(label).toFixed(1)}h`
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="soldPct"
                        stroke="url(#demand-pressure-gradient)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="text-sm font-medium text-foreground">
                      No deterministic preview
                    </div>
                    <div className="text-xs text-muted-foreground max-w-md">
                      Greedy selling depends on simulated price relative to the
                      community&apos;s average entry price. Run the simulation to
                      see when sells trigger.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Presets */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Community Behavior
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setLocalConfig((prev) => ({ ...prev, preset: "loyal" }))
                  }
                  className={[
                    "rounded-lg border p-3 text-left transition-colors",
                    "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/30",
                    localConfig.preset === "loyal"
                      ? "ring-2 ring-emerald-500/60"
                      : "",
                  ].join(" ")}
                >
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Loyal community
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Most holders keep their tokens; only a small portion is sold
                    over time.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setLocalConfig((prev) => ({ ...prev, preset: "greedy" }))
                  }
                  className={[
                    "rounded-lg border p-3 text-left transition-colors",
                    "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30",
                    localConfig.preset === "greedy"
                      ? "ring-2 ring-amber-500/60"
                      : "",
                  ].join(" ")}
                >
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Greedy community
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Holders take profit quickly when price moves above their
                    entry.
                  </div>
                </button>
              </div>
            </div>

            <Separator />

            {/* Scenario parameters */}
            <div className="space-y-4">
              {localConfig.preset === "loyal" ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Total sold share of community tokens (%)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={localConfig.loyalSoldPct}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          loyalSoldPct: Number(e.target.value),
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Approximate share of community-held tokens that will be
                      sold over the whole campaign.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">
                      Concentration at start &amp; end (% of sell weight)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={localConfig.loyalConcentrationPct}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          loyalConcentrationPct: Number(e.target.value),
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      How much of the selling happens early and late vs. evenly
                      throughout the LBP.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Profit spread above cost basis (%)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={localConfig.greedySpreadPct}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          greedySpreadPct: Number(e.target.value),
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      When market price is at least this % above the
                      community&apos;s average buy price, they start selling.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">
                      Portion of holdings sold on trigger (%)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={localConfig.greedySellPct}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          greedySellPct: Number(e.target.value),
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Example: 25% means at each trigger they sell a quarter of
                      their remaining tokens.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export const SellPressureConfig = memo(SellPressureConfigComponent);

