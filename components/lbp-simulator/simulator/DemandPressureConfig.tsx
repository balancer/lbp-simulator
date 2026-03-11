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
import { DEFAULT_DEMAND_PRESSURE_CONFIG } from "@/lib/lbp-math";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  getCumulativeBuyPressureCurve,
  DemandPressureConfig as DemandPressureConfigType,
} from "@/lib/lbp-math";
import { useDebounce } from "@/lib/useDebounce";
import { useShallow } from "zustand/react/shallow";
import { GiBull } from "react-icons/gi";
import { GiBearFace } from "react-icons/gi";
import { formatNumber } from "@/lib/utils";

const MAGNITUDE_BASES = [10_000, 100_000, 1_000_000] as const;

function parseNumberInput(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

function pickMagnitudeBaseForTarget(target: number) {
  // Prefer multipliers in a "nice" range so the UI stays readable.
  let best = 100_000 as (typeof MAGNITUDE_BASES)[number];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const base of MAGNITUDE_BASES) {
    const mult = target / base;
    const penaltyLow = mult < 0.1 ? 10 + (0.1 - mult) * 50 : 0;
    const penaltyHigh = mult > 20 ? 10 + (mult - 20) : 0;
    const score =
      penaltyLow +
      penaltyHigh +
      Math.abs(Math.log10(Math.max(1e-9, mult)));
    if (score < bestScore) {
      bestScore = score;
      best = base;
    }
  }

  return best;
}

function DemandPressureConfigComponent() {
  const { demandPressureConfig, updateDemandPressureConfig, config } =
    useSimulatorStore(
      useShallow((state) => ({
        demandPressureConfig: state.demandPressureConfig,
        updateDemandPressureConfig: state.updateDemandPressureConfig,
        config: state.config,
      })),
    );

  // Local state for immediate UI updates
  const [localConfig, setLocalConfig] =
    useState<DemandPressureConfigType>(demandPressureConfig);
  const [endCumulativeInput, setEndCumulativeInput] = useState<string>("");
  const [isEditingEndCumulative, setIsEditingEndCumulative] = useState(false);

  // Update local state when store config changes (e.g., reset)
  useEffect(() => {
    setLocalConfig(demandPressureConfig);
  }, [demandPressureConfig]);

  const endScale = localConfig.preset === "bearish" ? 0.35 : 1.0;
  const endCumulativeValue =
    localConfig.magnitudeBase * localConfig.multiplier * endScale;

  // Keep the "single number" input in sync with underlying magnitudeBase * multiplier (and preset scaling),
  // but don't fight the user while they're typing.
  useEffect(() => {
    if (isEditingEndCumulative) return;
    setEndCumulativeInput(formatNumber(Math.round(endCumulativeValue)));
  }, [endCumulativeValue, isEditingEndCumulative]);

  // Debounce the local config before updating the store
  const debouncedConfig = useDebounce(localConfig, 500);

  // Update store when debounced config changes
  useEffect(() => {
    // Deep comparison to avoid unnecessary updates
    const configsEqual =
      JSON.stringify(debouncedConfig) === JSON.stringify(demandPressureConfig);
    if (!configsEqual) {
      updateDemandPressureConfig(debouncedConfig);
    }
  }, [debouncedConfig, demandPressureConfig, updateDemandPressureConfig]);

  // Generate preview curve data using debounced config for calculations, but local for immediate preview
  const previewData = useMemo(() => {
    const cumulative = getCumulativeBuyPressureCurve(
      config.duration,
      100,
      localConfig,
    );
    return cumulative.map((cumulativeUsdc, i) => ({
      time: (i / 100) * config.duration,
      cumulativeUsdc,
    }));
  }, [localConfig, config.duration]);

  const handleReset = () => {
    updateDemandPressureConfig(DEFAULT_DEMAND_PRESSURE_CONFIG);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-full"
          title="Configure Demand Pressure"
        >
          Model the buy pressure
          <TrendingUp className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 border-b flex flex-row items-center justify-between space-y-0 shrink-0">
          <DialogTitle className="text-xl font-semibold">
            Buy Pressure Model
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
              <div className="h-[250px] border rounded-md p-4">
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
                      tickFormatter={(val) => {
                        const n = Number(val);
                        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                        if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
                        return `${n.toFixed(0)}`;
                      }}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => {
                        if (value == null) return "";
                        return `${Number(value).toLocaleString()} ${config.collateralToken}`;
                      }}
                      labelFormatter={(label) =>
                        `Time: ${Number(label).toFixed(1)}h`
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeUsdc"
                      stroke="url(#demand-pressure-gradient)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <Separator />

            {/* Buy Pressure Curve */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Buy Pressure Curve
              </h3>

              <div className="space-y-2">
                <Label className="text-xs">Preset</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLocalConfig((prev) => {
                        const prevEndScale = prev.preset === "bearish" ? 0.35 : 1.0;
                        const targetEndTotal =
                          prev.magnitudeBase * prev.multiplier * prevEndScale;
                        const nextEndScale = 1.0;
                        const unscaled =
                          nextEndScale > 0 ? targetEndTotal / nextEndScale : targetEndTotal;
                        const base = pickMagnitudeBaseForTarget(unscaled);
                        const nextMultiplier = base > 0 ? unscaled / base : 0;
                        return {
                          ...prev,
                          preset: "bullish",
                          magnitudeBase: base,
                          multiplier: nextMultiplier,
                        };
                      })
                    }
                    className={[
                      "rounded-lg border p-3 text-left transition-colors",
                      "bg-blue-500/10 hover:bg-blue-500/15 border-blue-500/30",
                      localConfig.preset === "bullish"
                        ? "ring-2 ring-blue-500/60"
                        : "",
                    ].join(" ")}
                  >
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex gap-2 items-center">
                    <GiBull size={24} color="blue" />
                      Bullish
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Constant high buy pressure
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setLocalConfig((prev) => {
                        const prevEndScale = prev.preset === "bearish" ? 0.35 : 1.0;
                        const targetEndTotal =
                          prev.magnitudeBase * prev.multiplier * prevEndScale;
                        const nextEndScale = 0.35;
                        const unscaled =
                          nextEndScale > 0 ? targetEndTotal / nextEndScale : targetEndTotal;
                        const base = pickMagnitudeBaseForTarget(unscaled);
                        const nextMultiplier = base > 0 ? unscaled / base : 0;
                        return {
                          ...prev,
                          preset: "bearish",
                          magnitudeBase: base,
                          multiplier: nextMultiplier,
                        };
                      })
                    }
                    className={[
                      "rounded-lg border p-3 text-left transition-colors",
                      "bg-red-500/10 hover:bg-red-500/15 border-red-500/30",
                      localConfig.preset === "bearish"
                        ? "ring-2 ring-red-500/60"
                        : "",
                    ].join(" ")}
                  >
                    <div className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                      <GiBearFace size={24} color="red"/>
                      Bearish
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Ramps up slowly, lighter overall
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">
                  End cumulative buy (target)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={endCumulativeInput}
                    onFocus={() => setIsEditingEndCumulative(true)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setEndCumulativeInput(raw);
                      const desired = parseNumberInput(raw);
                      if (desired == null || desired < 0) return;

                      const unscaled = endScale > 0 ? desired / endScale : desired;
                      const base = pickMagnitudeBaseForTarget(unscaled);
                      const nextMultiplier = base > 0 ? unscaled / base : 0;

                      setLocalConfig((prev) => ({
                        ...prev,
                        magnitudeBase: base,
                        multiplier: nextMultiplier,
                      }));
                    }}
                    onBlur={() => {
                      setIsEditingEndCumulative(false);
                      const desired = parseNumberInput(endCumulativeInput);
                      if (desired == null || desired < 0) {
                        setEndCumulativeInput(formatNumber(Math.round(endCumulativeValue)));
                        return;
                      }
                      setEndCumulativeInput(formatNumber(Math.round(desired)));
                    }}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {config.collateralToken}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Value at the end of the campaign (cumulative).{" "}
                  <span className="font-mono">
                    {formatNumber(parseNumberInput(endCumulativeInput) ?? 0)}
                  </span>{" "}
                  {config.collateralToken}
                  {localConfig.preset === "bearish" ? (
                    <>
                      {" "}
                      (bearish preset applies a <span className="font-mono">0.35</span> end-scale)
                    </>
                  ) : null}
                  .
                </p>
              </div>

              <details className="rounded-md border bg-muted/30 p-3">
                <summary className="cursor-pointer select-none text-xs text-muted-foreground">
                  Advanced (magnitude base + multiplier)
                </summary>
                <div className="pt-3 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Magnitude base
                    </Label>
                    <Select
                      value={String(localConfig.magnitudeBase)}
                      onValueChange={(value) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          magnitudeBase: Number(value) as DemandPressureConfigType["magnitudeBase"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select magnitude" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10000">10k</SelectItem>
                        <SelectItem value="100000">100k</SelectItem>
                        <SelectItem value="1000000">1M</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Multiplier</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={localConfig.multiplier}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          multiplier: Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Internally:{" "}
                    <span className="font-mono">
                      endTotal = magnitudeBase × multiplier × endScale
                    </span>
                    . Current:{" "}
                    <span className="font-mono">
                      {formatNumber(localConfig.magnitudeBase)} ×{" "}
                      {Number(localConfig.multiplier).toFixed(3)}
                    </span>
                    .
                  </p>
                </div>
              </details>

	              <div className="space-y-2">
	                <Label className="text-xs">Price Elasticity (optional)</Label>
	                <div className="grid grid-cols-2 gap-2">
	                  <div className="space-y-2">
	                    <Label className="text-[11px] text-muted-foreground">
	                      Elasticity exponent
	                    </Label>
	                    <Input
	                      type="number"
	                      min={0}
	                      step={0.1}
	                      value={localConfig.priceElasticity ?? 0}
	                      onChange={(e) =>
	                        setLocalConfig((prev) => ({
	                          ...prev,
	                          priceElasticity: Number(e.target.value),
	                        }))
	                      }
	                    />
	                  </div>

	                  <div className="space-y-2">
	                    <Label className="text-[11px] text-muted-foreground">
	                      Direction
	                    </Label>
	                    <Select
	                      value={localConfig.priceElasticityDirection ?? "down-only"}
	                      onValueChange={(value) =>
	                        setLocalConfig((prev) => ({
	                          ...prev,
	                          priceElasticityDirection: value as DemandPressureConfigType["priceElasticityDirection"],
	                        }))
	                      }
	                    >
	                      <SelectTrigger>
	                        <SelectValue placeholder="Select mode" />
	                      </SelectTrigger>
	                      <SelectContent>
	                        <SelectItem value="down-only">Down-only</SelectItem>
	                        <SelectItem value="symmetric">Symmetric</SelectItem>
	                      </SelectContent>
	                    </Select>
	                  </div>
	                </div>

	                <div className="space-y-2">
	                  <Label className="text-[11px] text-muted-foreground">
	                    Reference price multiplier (vs initial spot)
	                  </Label>
	                  <Input
	                    type="number"
	                    min={0.01}
	                    step={0.05}
	                    value={localConfig.priceElasticityReferenceMultiplier ?? 1}
	                    onChange={(e) =>
	                      setLocalConfig((prev) => ({
	                        ...prev,
	                        priceElasticityReferenceMultiplier: Number(e.target.value),
	                      }))
	                    }
	                  />
	                </div>

	                <div className="grid grid-cols-2 gap-2">
	                  <div className="space-y-2">
	                    <Label className="text-[11px] text-muted-foreground">
	                      Execution model
	                    </Label>
	                    <Select
	                      value={localConfig.priceElasticityExecutionModel ?? "multiplier"}
	                      onValueChange={(value) =>
	                        setLocalConfig((prev) => ({
	                          ...prev,
	                          priceElasticityExecutionModel: value as DemandPressureConfigType["priceElasticityExecutionModel"],
	                        }))
	                      }
	                    >
	                      <SelectTrigger>
	                        <SelectValue placeholder="Select model" />
	                      </SelectTrigger>
	                      <SelectContent>
	                        <SelectItem value="multiplier">Multiplier</SelectItem>
	                        <SelectItem value="backlog">Backlog</SelectItem>
	                      </SelectContent>
	                    </Select>
	                  </div>

	                  <div className="space-y-2">
	                    <Label className="text-[11px] text-muted-foreground">
	                      Backlog max spend (x)
	                    </Label>
	                    <Input
	                      type="number"
	                      min={1}
	                      step={1}
	                      value={localConfig.priceElasticityBacklogMaxSpendMultiplier ?? 5}
	                      onChange={(e) =>
	                        setLocalConfig((prev) => ({
	                          ...prev,
	                          priceElasticityBacklogMaxSpendMultiplier: Number(e.target.value),
	                        }))
	                      }
	                    />
	                  </div>
	                </div>

	                <p className="text-xs text-muted-foreground">
	                  Scales per-step buys by <span className="font-mono">(P_ref / P_now)^e</span>,
	                  where <span className="font-mono">P_ref</span> is the initial spot price times this multiplier.
	                  Use &lt;1 to model users waiting for a cheaper price.
	                </p>
	              </div>
	            </div>
	          </div>
	        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export const DemandPressureConfig = memo(DemandPressureConfigComponent);
