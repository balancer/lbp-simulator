"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo, useState, useEffect } from "react";
import { getDemandPressureCurve, DemandPressureConfig as DemandPressureConfigType } from "@/lib/lbp-math";
import { useDebounce } from "@/lib/useDebounce";
import { useShallow } from "zustand/react/shallow";

export function DemandPressureConfig() {
  const { demandPressureConfig, updateDemandPressureConfig, config } = useSimulatorStore(
    useShallow((state) => ({
      demandPressureConfig: state.demandPressureConfig,
      updateDemandPressureConfig: state.updateDemandPressureConfig,
      config: state.config,
    })),
  );

  // Local state for immediate UI updates
  const [localConfig, setLocalConfig] = useState<DemandPressureConfigType>(demandPressureConfig);

  // Update local state when store config changes (e.g., reset)
  useEffect(() => {
    setLocalConfig(demandPressureConfig);
  }, [demandPressureConfig]);

  // Debounce the local config before updating the store
  const debouncedConfig = useDebounce(localConfig, 500);

  // Update store when debounced config changes
  useEffect(() => {
    // Deep comparison to avoid unnecessary updates
    const configsEqual = JSON.stringify(debouncedConfig) === JSON.stringify(demandPressureConfig);
    if (!configsEqual) {
      updateDemandPressureConfig(debouncedConfig);
    }
  }, [debouncedConfig, demandPressureConfig, updateDemandPressureConfig]);

  // Generate preview curve data using debounced config for calculations, but local for immediate preview
  const previewData = useMemo(() => {
    const curve = getDemandPressureCurve(config.duration, 100, localConfig);
    return curve.map((intensity, i) => ({
      time: (i / 100) * config.duration,
      intensity: intensity * 100, // Convert to percentage for display
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
          Model the demmand pressure
          <TrendingUp className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 border-b flex flex-row items-center justify-between space-y-0 shrink-0">
          <DialogTitle className="text-xl font-semibold">Demand Pressure Model</DialogTitle>
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
              <div className="h-[200px] border rounded-md p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={previewData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="time"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickFormatter={(val) => `${val.toFixed(0)}h`}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => value != null ? `${value.toFixed(1)}%` : ""}
                      labelFormatter={(label) => `Time: ${Number(label).toFixed(1)}h`}
                    />
                    <Line
                      type="monotone"
                      dataKey="intensity"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <Separator />

            {/* Intensity Parameters */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Intensity Parameters
              </h3>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Base Intensity</Label>
                  <span className="text-sm text-muted-foreground">
                    {(localConfig.baseIntensity * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[localConfig.baseIntensity]}
                  onValueChange={(vals) =>
                    setLocalConfig((prev) => ({ ...prev, baseIntensity: vals[0] }))
                  }
                  min={0}
                  max={1}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum trading intensity at the end of the sale (when price finds fair value)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Floor Intensity</Label>
                  <span className="text-sm text-muted-foreground">
                    {(localConfig.floorIntensity * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[localConfig.floorIntensity]}
                  onValueChange={(vals) =>
                    setLocalConfig((prev) => ({ ...prev, floorIntensity: vals[0] }))
                  }
                  min={0}
                  max={1}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum trading intensity at the start (high price prevents front-running)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Growth Rate</Label>
                  <span className="text-sm text-muted-foreground">
                    {localConfig.growthRate.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[localConfig.growthRate]}
                  onValueChange={(vals) =>
                    setLocalConfig((prev) => ({ ...prev, growthRate: vals[0] }))
                  }
                  min={0.5}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  How fast trading intensity grows over time (square root curve steepness)
                </p>
              </div>
            </div>

            <Separator />

            {/* Trading Parameters */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Trading Parameters
              </h3>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Price Discount Multiplier</Label>
                  <span className="text-sm text-muted-foreground">
                    {localConfig.priceDiscountMultiplier.toFixed(2)}x
                  </span>
                </div>
                <Slider
                  value={[localConfig.priceDiscountMultiplier]}
                  onValueChange={(vals) =>
                    setLocalConfig((prev) => ({ ...prev, priceDiscountMultiplier: vals[0] }))
                  }
                  min={0.5}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  How much price discounts amplify trading volume
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Base Trade Size (USDC)</Label>
                <Input
                  type="number"
                  value={localConfig.baseTradeSize}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({ ...prev, baseTradeSize: Number(e.target.value) }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Base size for bot trades in USDC
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Trade Size Variation</Label>
                  <span className="text-sm text-muted-foreground">
                    {localConfig.tradeSizeVariation.toFixed(1)}x
                  </span>
                </div>
                <Slider
                  value={[localConfig.tradeSizeVariation]}
                  onValueChange={(vals) =>
                    setLocalConfig((prev) => ({ ...prev, tradeSizeVariation: vals[0] }))
                  }
                  min={1}
                  max={5}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum variation multiplier for trade sizes
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
