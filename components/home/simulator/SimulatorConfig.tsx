"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Play, Pause, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { DemandPressureConfig } from "./DemandPressureConfig";
import { SellPressureConfig } from "./SellPressureConfig";
import { useState, useEffect, useTransition, memo, useCallback } from "react";
import { useDebounce } from "@/lib/useDebounce";
import { LBPConfig } from "@/lib/lbp-math";
import { useShallow } from "zustand/shallow";
import { TokenLogo } from "@/components/ui/TokenLogo";

function SimulatorConfigComponent() {
  const { setOpen, toggleSidebar } = useSidebar();
  const {
    config,
    updateConfig,
    isPlaying,
    setIsPlaying,
    resetConfig,
    simulationSpeed,
    setSimulationSpeed,
  } = useSimulatorStore(
    useShallow((state) => ({
      config: state.config,
      updateConfig: state.updateConfig,
      isPlaying: state.isPlaying,
      setIsPlaying: state.setIsPlaying,
      resetConfig: state.resetConfig,
      simulationSpeed: state.simulationSpeed,
      setSimulationSpeed: state.setSimulationSpeed,
    })),
  );

  const [isPending, startTransition] = useTransition();

  const handleSidebarClose = useCallback(() => {
    setLocalDuration(config.duration);
    setLocalTknWeightIn(config.tknWeightIn);
    setLocalTknWeightOut(config.tknWeightOut);
    setLocalPercentForSale(config.percentForSale);
    setLocalTotalSupply(config.totalSupply);
    setLocalUsdcBalanceIn(config.usdcBalanceIn);
    setOpen(false);
  }, [config, setOpen]);

  // Local state for immediate UI updates (for sliders/inputs that trigger expensive recalculations)
  const [localDuration, setLocalDuration] = useState(config.duration);
  const [localTknWeightIn, setLocalTknWeightIn] = useState(config.tknWeightIn);
  const [localTknWeightOut, setLocalTknWeightOut] = useState(
    config.tknWeightOut,
  );
  const [localPercentForSale, setLocalPercentForSale] = useState(
    config.percentForSale,
  );
  const [localTotalSupply, setLocalTotalSupply] = useState(config.totalSupply);
  const [localUsdcBalanceIn, setLocalUsdcBalanceIn] = useState(
    config.usdcBalanceIn,
  );

  // Update local state when store config changes
  useEffect(() => {
    setLocalDuration(config.duration);
    setLocalTknWeightIn(config.tknWeightIn);
    setLocalTknWeightOut(config.tknWeightOut);
    setLocalPercentForSale(config.percentForSale);
    setLocalTotalSupply(config.totalSupply);
    setLocalUsdcBalanceIn(config.usdcBalanceIn);
  }, [
    config.duration,
    config.tknWeightIn,
    config.tknWeightOut,
    config.percentForSale,
    config.totalSupply,
    config.usdcBalanceIn,
  ]);

  // Debounce expensive config updates
  const debouncedDuration = useDebounce(localDuration, 500);
  const debouncedTknWeightIn = useDebounce(localTknWeightIn, 500);
  const debouncedTknWeightOut = useDebounce(localTknWeightOut, 500);
  const debouncedPercentForSale = useDebounce(localPercentForSale, 500);
  const debouncedTotalSupply = useDebounce(localTotalSupply, 500);
  const debouncedUsdcBalanceIn = useDebounce(localUsdcBalanceIn, 500);

  // Update store when debounced values change
  useEffect(() => {
    if (debouncedDuration !== config.duration) {
      startTransition(() => {
        updateConfig({ duration: debouncedDuration });
      });
    }
  }, [debouncedDuration, config.duration, updateConfig]);

  useEffect(() => {
    if (debouncedTknWeightIn !== config.tknWeightIn) {
      startTransition(() => {
        updateConfig({
          tknWeightIn: debouncedTknWeightIn,
          usdcWeightIn: 100 - debouncedTknWeightIn,
        });
      });
    }
  }, [debouncedTknWeightIn, config.tknWeightIn, updateConfig]);

  useEffect(() => {
    if (debouncedTknWeightOut !== config.tknWeightOut) {
      startTransition(() => {
        updateConfig({
          tknWeightOut: debouncedTknWeightOut,
          usdcWeightOut: 100 - debouncedTknWeightOut,
        });
      });
    }
  }, [debouncedTknWeightOut, config.tknWeightOut, updateConfig]);

  useEffect(() => {
    if (
      debouncedPercentForSale !== config.percentForSale ||
      debouncedTotalSupply !== config.totalSupply
    ) {
      startTransition(() => {
        updateConfig({
          percentForSale: debouncedPercentForSale,
          totalSupply: debouncedTotalSupply,
        });
      });
    }
  }, [
    debouncedPercentForSale,
    debouncedTotalSupply,
    config.percentForSale,
    config.totalSupply,
    updateConfig,
  ]);

  useEffect(() => {
    if (debouncedUsdcBalanceIn !== config.usdcBalanceIn) {
      startTransition(() => {
        updateConfig({ usdcBalanceIn: debouncedUsdcBalanceIn });
      });
    }
  }, [debouncedUsdcBalanceIn, config.usdcBalanceIn, updateConfig]);

  const handleWeightChange = (newTknWeightIn: number) => {
    setLocalTknWeightIn(newTknWeightIn);
  };

  const handleEndWeightChange = (newTknWeightOut: number) => {
    setLocalTknWeightOut(newTknWeightOut);
  };

  return (
    <>
      <SidebarContent className="rounded-xl border border-border/60 dark:bg-[#0F0F0F] shadow-xl">
        <ScrollArea className="flex-1 min-h-0 h-full">
          <div className="p-4 mt-2 pb-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Column 1: Timeline + pressure configs */}
              <div className="space-y-4 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Timeline
                  </h3>
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

                <div className="flex items-center gap-3">
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
                  <div className="flex flex-1 min-w-0 items-center gap-2">
                    <div className="flex flex-col flex-1 min-w-0 gap-1">
                      <Label className="text-xs">
                        Duration: {localDuration / 24} days
                      </Label>
                      <Slider
                        value={[localDuration / 24]}
                        onValueChange={(vals) =>
                          setLocalDuration(Math.round(vals[0]) * 24)
                        }
                        min={1}
                        max={60}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <Input
                      className="w-14 shrink-0"
                      type="number"
                      min={1}
                      max={60}
                      step={0.5}
                      value={localDuration / 24}
                      onChange={(e) => {
                        const days = parseFloat(e.target.value);
                        if (!isNaN(days))
                          setLocalDuration(
                            Math.max(24, Math.min(days * 24, 1440))
                          );
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                  {[1, 5, 10].map((speed) => (
                    <Button
                      key={speed}
                      variant="ghost"
                      size="sm"
                      onClick={() => setSimulationSpeed(speed)}
                      className={`h-7 px-3 text-xs rounded-sm flex-1 ${
                        simulationSpeed === speed
                          ? "bg-background shadow-sm text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {speed}x
                    </Button>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <DemandPressureConfig />
                  <SellPressureConfig />
                </div>
              </div>

              {/* Column 2: Tokenomics – identity & supply */}
              <div className="space-y-4 min-w-0">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Tokenomics
                </h3>
                {/* <div className="grid grid-cols-2 gap-3">
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
              </div> */}

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
                    <Label>% for Sale</Label>
                    <span className="text-sm text-muted-foreground">
                      {localPercentForSale}%
                    </span>
                  </div>
                  <Slider
                    value={[localPercentForSale]}
                    max={90}
                    min={1}
                    step={1}
                    onValueChange={(vals) => setLocalPercentForSale(vals[0])}
                  />
                  <p className="text-xs text-muted-foreground">
                    For sale:{" "}
                    {(
                      (localTotalSupply * (localPercentForSale / 100)) /
                      1_000_000
                    ).toFixed(2)}
                    M
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Initial Liquidity (USDC)</Label>
                  <Input
                    type="number"
                    value={localUsdcBalanceIn}
                    onChange={(e) =>
                      setLocalUsdcBalanceIn(Number(e.target.value))
                    }
                  />
                </div>
              </div>

              {/* Column 3: Weights */}
              <div className="flex flex-col space-y-4 min-w-0 gap-2">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Weights
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Start (Token / {config.collateralToken})</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono w-10 shrink-0">
                        {config.tknWeightIn}%
                      </span>
                      <Slider
                        value={[localTknWeightIn]}
                        max={99}
                        min={1}
                        step={1}
                        onValueChange={(vals) => handleWeightChange(vals[0])}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono w-10 shrink-0 text-right">
                        {config.usdcWeightIn}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>End (Token / {config.collateralToken})</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono w-10 shrink-0">
                        {config.tknWeightOut}%
                      </span>
                      <Slider
                        value={[localTknWeightOut]}
                        max={99}
                        min={1}
                        step={1}
                        onValueChange={(vals) => handleEndWeightChange(vals[0])}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono w-10 shrink-0 text-right">
                        {config.usdcWeightOut}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <Label>Collateral Token</Label>
                    <Select
                      value={config.collateralToken}
                      onValueChange={(value) =>
                        updateConfig({
                          collateralToken: value as "USDC" | "USDT" | "ETH" | "wETH",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select collateral token" />
                      </SelectTrigger>
                      <SelectContent>
                        {["USDC", "USDT", "ETH", "wETH"].map((token) => (
                          <SelectItem key={token} value={token}>
                            <span className="flex items-center gap-2">
                              <span className="inline-block">
                                <TokenLogo token={token} size={18} />
                              </span>
                              {token}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      Balancer 10%. Swap fee 1–10%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SidebarContent>
    </>
  );
}

export const SimulatorConfig = memo(SimulatorConfigComponent);
