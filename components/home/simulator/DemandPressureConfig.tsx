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

  // Update local state when store config changes (e.g., reset)
  useEffect(() => {
    setLocalConfig(demandPressureConfig);
  }, [demandPressureConfig]);

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
                      setLocalConfig((prev) => ({ ...prev, preset: "bullish" }))
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
                      setLocalConfig((prev) => ({ ...prev, preset: "bearish" }))
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
                <Label className="text-xs">Magnitude (end cumulative buy)</Label>
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
                <p className="text-xs text-muted-foreground">
                  Controls the Y-axis scale (USDC cumulative over time).
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Fine-tune the curve’s magnitude (e.g. 0.5x, 2x).
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
