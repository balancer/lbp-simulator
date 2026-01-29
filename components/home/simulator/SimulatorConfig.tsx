"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Play, Pause, RotateCcw, Plus, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { DemandPressureConfig } from "./DemandPressureConfig";
import { SellPressureConfig } from "./SellPressureConfig";
import { useState, useEffect, useTransition, memo } from "react";
import { useDebounce } from "@/lib/useDebounce";
import { LBPConfig } from "@/lib/lbp-math";
import { useShallow } from "zustand/shallow";

function SimulatorConfigComponent() {
  const {
    config,
    updateConfig,
    isPlaying,
    setIsPlaying,
    resetConfig,
    simulationSpeed,
    setSimulationSpeed,
    isConfigOpen,
    setIsConfigOpen,
  } = useSimulatorStore(
    useShallow((state) => ({
      config: state.config,
      updateConfig: state.updateConfig,
      isPlaying: state.isPlaying,
      setIsPlaying: state.setIsPlaying,
      resetConfig: state.resetConfig,
      simulationSpeed: state.simulationSpeed,
      setSimulationSpeed: state.setSimulationSpeed,
      isConfigOpen: state.isConfigOpen,
      setIsConfigOpen: state.setIsConfigOpen,
    })),
  );

  const [isPending, startTransition] = useTransition();

  // Simple handler for sheet open/close
  const handleSheetOpenChange = (open: boolean) => {
    setIsConfigOpen(open);
    
    // Reset local state when closing to match store
    if (!open) {
      setLocalDuration(config.duration);
      setLocalTknWeightIn(config.tknWeightIn);
      setLocalTknWeightOut(config.tknWeightOut);
      setLocalPercentForSale(config.percentForSale);
      setLocalTotalSupply(config.totalSupply);
      setLocalUsdcBalanceIn(config.usdcBalanceIn);
    }
  };

  // Local state for immediate UI updates (for sliders/inputs that trigger expensive recalculations)
  const [localDuration, setLocalDuration] = useState(config.duration);
  const [localTknWeightIn, setLocalTknWeightIn] = useState(config.tknWeightIn);
  const [localTknWeightOut, setLocalTknWeightOut] = useState(config.tknWeightOut);
  const [localPercentForSale, setLocalPercentForSale] = useState(config.percentForSale);
  const [localTotalSupply, setLocalTotalSupply] = useState(config.totalSupply);
  const [localUsdcBalanceIn, setLocalUsdcBalanceIn] = useState(config.usdcBalanceIn);

  // Update local state when store config changes
  useEffect(() => {
    setLocalDuration(config.duration);
    setLocalTknWeightIn(config.tknWeightIn);
    setLocalTknWeightOut(config.tknWeightOut);
    setLocalPercentForSale(config.percentForSale);
    setLocalTotalSupply(config.totalSupply);
    setLocalUsdcBalanceIn(config.usdcBalanceIn);
  }, [config.duration, config.tknWeightIn, config.tknWeightOut, config.percentForSale, config.totalSupply, config.usdcBalanceIn]);

  // Debounce expensive config updates
  const debouncedDuration = useDebounce(localDuration, 500);
  const debouncedTknWeightIn = useDebounce(localTknWeightIn, 500);
  const debouncedTknWeightOut = useDebounce(localTknWeightOut, 500);
  const debouncedPercentForSale = useDebounce(localPercentForSale, 500);
  const debouncedTotalSupply = useDebounce(localTotalSupply, 500);
  const debouncedUsdcBalanceIn = useDebounce(localUsdcBalanceIn, 500);

  // Update store when debounced values change (only when sheet is open to avoid lag on close)
  useEffect(() => {
    if (!isConfigOpen) return; // Skip updates when sheet is closed
    if (debouncedDuration !== config.duration) {
      startTransition(() => {
        updateConfig({ duration: debouncedDuration });
      });
    }
  }, [debouncedDuration, config.duration, updateConfig, isConfigOpen]);

  useEffect(() => {
    if (!isConfigOpen) return;
    if (debouncedTknWeightIn !== config.tknWeightIn) {
      startTransition(() => {
        updateConfig({
          tknWeightIn: debouncedTknWeightIn,
          usdcWeightIn: 100 - debouncedTknWeightIn,
        });
      });
    }
  }, [debouncedTknWeightIn, config.tknWeightIn, updateConfig, isConfigOpen]);

  useEffect(() => {
    if (!isConfigOpen) return;
    if (debouncedTknWeightOut !== config.tknWeightOut) {
      startTransition(() => {
        updateConfig({
          tknWeightOut: debouncedTknWeightOut,
          usdcWeightOut: 100 - debouncedTknWeightOut,
        });
      });
    }
  }, [debouncedTknWeightOut, config.tknWeightOut, updateConfig, isConfigOpen]);

  useEffect(() => {
    if (!isConfigOpen) return;
    if (debouncedPercentForSale !== config.percentForSale || debouncedTotalSupply !== config.totalSupply) {
      startTransition(() => {
        updateConfig({
          percentForSale: debouncedPercentForSale,
          totalSupply: debouncedTotalSupply,
        });
      });
    }
  }, [debouncedPercentForSale, debouncedTotalSupply, config.percentForSale, config.totalSupply, updateConfig, isConfigOpen]);

  useEffect(() => {
    if (!isConfigOpen) return;
    if (debouncedUsdcBalanceIn !== config.usdcBalanceIn) {
      startTransition(() => {
        updateConfig({ usdcBalanceIn: debouncedUsdcBalanceIn });
      });
    }
  }, [debouncedUsdcBalanceIn, config.usdcBalanceIn, updateConfig, isConfigOpen]);

  const handleWeightChange = (newTknWeightIn: number) => {
    setLocalTknWeightIn(newTknWeightIn);
  };

  const handleEndWeightChange = (newTknWeightOut: number) => {
    setLocalTknWeightOut(newTknWeightOut);
  };

  return (
    <Sheet open={isConfigOpen} onOpenChange={handleSheetOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="fixed left-4 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-r-xl rounded-l-none shadow-lg bg-background border border-l-0 border-border/40 hover:bg-muted/80 transition-all duration-300 md:left-0"
        >
          <Settings className="h-6 w-6 text-muted-foreground" />
          <span className="sr-only">Open Config</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[400px] sm:w-[540px] p-0 gap-0">
        <SheetHeader className="p-6 border-b flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-xl font-semibold">Configs</SheetTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={resetConfig}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-8">
            {/* Timeline Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Timeline
                </h3>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      isPlaying
                        ? "bg-gradient-to-r from-blue-300 via-purple-300 to-orange-300 hover:from-blue-400 hover:via-purple-400 hover:to-orange-400 text-slate-900 border-0 font-semibold"
                        : ""
                    }
                  >
                    {isPlaying ? "Active" : "Paused"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex-1 space-y-2">
                  <Label className="text-xs">
                    Duration: {localDuration} Hours
                  </Label>
                  <Slider
                    value={[localDuration]}
                    onValueChange={(vals) => setLocalDuration(vals[0])}
                    max={2160}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                  {[1, 5, 10].map((speed) => (
                    <Button
                      key={speed}
                      variant="ghost"
                      size="sm"
                      onClick={() => setSimulationSpeed(speed)}
                      className={`h-7 px-3 text-xs rounded-sm ${
                        simulationSpeed === speed
                          ? "bg-background shadow-sm text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {speed}x
                    </Button>
                  ))}
                </div>
              </div>
              {/* Buy and sell pressure configs */}
              <div className="flex flex-col gap-2">
                <DemandPressureConfig />
                <SellPressureConfig />
              </div>
            </div>

            <Separator />

            {/* Tokenomics Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Tokenomics
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Project Name</Label>
                    <Input
                      value={config.tokenName}
                      onChange={(e) =>
                        updateConfig({ tokenName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Token Symbol</Label>
                    <Input
                      value={config.tokenSymbol}
                      onChange={(e) =>
                        updateConfig({ tokenSymbol: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Collateral Token</Label>
                  <Select
                    value={config.collateralToken}
                    onValueChange={(value) =>
                      updateConfig({ collateralToken: value as "USDC" | "ETH" | "wETH" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select collateral token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="ETH">ETH</SelectItem>
                      <SelectItem value="wETH">wETH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Total Supply</Label>
                  <Input
                    type="number"
                    value={localTotalSupply}
                    onChange={(e) =>
                      setLocalTotalSupply(Number(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Percentage for Sale</Label>
                    <span className="text-sm text-muted-foreground">
                      {localPercentForSale}%
                    </span>
                  </div>
                  <Slider
                    value={[localPercentForSale]}
                    max={90}
                    min={1}
                    step={1}
                    onValueChange={(vals) =>
                      setLocalPercentForSale(vals[0])
                    }
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    Tokens for Sale:{" "}
                    {(localTotalSupply * (localPercentForSale / 100) / 1_000_000).toFixed(2)}M
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Collateral Initial Liquidity (USDC)</Label>
                  <Input
                    type="number"
                    value={localUsdcBalanceIn}
                    onChange={(e) =>
                      setLocalUsdcBalanceIn(Number(e.target.value))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Swap Fee</Label>
                  <Select
                    value={String(config.swapFee || 5)}
                    onValueChange={(value) =>
                      updateConfig({ swapFee: Number(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select swap fee" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((fee) => (
                        <SelectItem key={fee} value={String(fee)}>
                          {fee}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Balancer fee is always 10%. Swap fee can be set from 1% to 10%.
                  </p>
                </div>
              </div>

              <div className="col-span-2 space-y-4 pt-2">
                <Label>Start Weights (Token / USDC)</Label>
                <div className="flex items-center gap-4">
                  <span className="w-12 text-sm font-mono">
                    {config.tknWeightIn}%
                  </span>
                  <Slider
                    value={[localTknWeightIn]}
                    max={99}
                    min={1}
                    step={1}
                    onValueChange={(vals) => handleWeightChange(vals[0])}
                  />
                  <span className="w-12 text-sm font-mono">
                    {config.usdcWeightIn}%
                  </span>
                </div>
              </div>

              <div className="col-span-2 space-y-4 pt-2">
                <Label>End Weights (Token / USDC)</Label>
                <div className="flex items-center gap-4">
                  <span className="w-12 text-sm font-mono">
                    {config.tknWeightOut}%
                  </span>
                  <Slider
                    value={[localTknWeightOut]}
                    max={99}
                    min={1}
                    step={1}
                    onValueChange={(vals) => handleEndWeightChange(vals[0])}
                  />
                  <span className="w-12 text-sm font-mono">
                    {config.usdcWeightOut}%
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="pt-4 text-center">
              <Button variant="link" className="text-xs text-muted-foreground">
                Hide for this session
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export const SimulatorConfig = memo(SimulatorConfigComponent);
