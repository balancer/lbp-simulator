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
import { useSimulatorStore } from "@/store/useSimulatorStore";

export function SimulatorConfig() {
  const { config, updateConfig, isPlaying, setIsPlaying, resetConfig } =
    useSimulatorStore();

  const handleWeightChange = (newTknWeightIn: number) => {
    // Basic constraint: weights sum to 100 roughly, but we track them separately in config
    // Let's implement a simple slide where tknWeight + usdcWeight = 100
    updateConfig({
      tknWeightIn: newTknWeightIn,
      usdcWeightIn: 100 - newTknWeightIn,
    });
  };

  const handleEndWeightChange = (newTknWeightOut: number) => {
    updateConfig({
      tknWeightOut: newTknWeightOut,
      usdcWeightOut: 100 - newTknWeightOut,
    });
  };

  return (
    <Sheet>
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
                  {/* Status indicators placeholder - kept purely visual for now */}
                  <div className="flex bg-muted rounded-md p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs rounded-sm bg-background shadow-sm text-foreground"
                    >
                      Active
                    </Button>
                  </div>
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
                    Duration: {config.duration} Hours
                  </Label>
                  <Slider
                    value={[config.duration]}
                    onValueChange={(vals) =>
                      updateConfig({ duration: vals[0] })
                    }
                    max={2160}
                    step={1}
                    className="w-full"
                  />
                </div>
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
                  <Label>Total Supply</Label>
                  <Input
                    type="number"
                    value={config.totalSupply}
                    onChange={(e) =>
                      updateConfig({ totalSupply: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Percentage for Sale</Label>
                    <span className="text-sm text-muted-foreground">
                      {config.percentForSale}%
                    </span>
                  </div>
                  <Slider
                    value={[config.percentForSale]}
                    max={90}
                    min={1}
                    step={1}
                    onValueChange={(vals) =>
                      updateConfig({ percentForSale: vals[0] })
                    }
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    Tokens for Sale:{" "}
                    {(config.tknBalanceIn / 1_000_000).toFixed(2)}M
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Collateral Initial Liquidity (USDC)</Label>
                  <Input
                    type="number"
                    value={config.usdcBalanceIn}
                    onChange={(e) =>
                      updateConfig({ usdcBalanceIn: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Creator Fee</Label>
                  <Select
                    value={String(config.creatorFee || 5)}
                    onValueChange={(value) =>
                      updateConfig({ creatorFee: Number(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select creator fee" />
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
                    Balancer fee is always 10%. Creator fee can be set from 1% to 10%.
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
                    value={[config.tknWeightIn]}
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
                    value={[config.tknWeightOut]}
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
