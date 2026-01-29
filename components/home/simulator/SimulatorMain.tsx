"use client";

import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwapForm } from "./SwapForm";
import { useMemo, useEffect, memo, useTransition, useState } from "react";
import { useDebounce } from "@/lib/useDebounce";
import { useThrottle } from "@/lib/useThrottle";
import { usePricePathsWorker } from "@/lib/hooks/usePricePathsWorker";
import { useSimulationWorker } from "@/lib/hooks/useSimulationWorker";
import { PriceChartTab } from "./tabs/PriceChartTab";
import { SwapsTab } from "./tabs/SwapsTab";
import { DemandChartTab } from "./tabs/DemandChartTab";
import { WeightsChartTab } from "./tabs/WeightsChartTab";

function SimulatorMainComponent() {
  const {
    simulationData,
    priceHistory,
    priceHistoryVersion,
    baseSnapshots,
    baseSnapshotsVersion,
    swaps,
    demandPressureCurve,
    sellPressureCurve,
    config,
    currentStep,
    simulationSpeed,
    demandPressureConfig,
    sellPressureConfig,
    isPlaying,
  } = useSimulatorStore(
    useShallow((state) => ({
      simulationData: state.simulationData,
      priceHistory: state.priceHistory,
      priceHistoryVersion: state.priceHistoryVersion,
      baseSnapshots: state.baseSnapshots,
      baseSnapshotsVersion: state.baseSnapshotsVersion,
      swaps: state.swaps,
      demandPressureCurve: state.demandPressureCurve,
      sellPressureCurve: state.sellPressureCurve,
      config: state.config,
      currentStep: state.currentStep,
      simulationSpeed: state.simulationSpeed,
      demandPressureConfig: state.demandPressureConfig,
      sellPressureConfig: state.sellPressureConfig,
      isPlaying: state.isPlaying,
    })),
  );

  // Precompute deterministic simulation path in a Web Worker.
  const { snapshots: workerSnapshots } = useSimulationWorker(
    config,
    demandPressureConfig,
    sellPressureConfig,
    simulationData.length > 0 ? simulationData.length - 1 : 0,
    true, // always keep base path ready; it's cheap at 300 steps
  );

  // When worker snapshots are ready, sync them into the store so tick() can use them.
  const setBaseSnapshots = useSimulatorStore((state) => state.setBaseSnapshots);
  useEffect(() => {
    if (workerSnapshots && workerSnapshots.length > 0) {
      setBaseSnapshots(workerSnapshots);
    }
  }, [workerSnapshots, setBaseSnapshots]);

  // Use transition to defer expensive chart recalculations when toggling play/pause
  const [isPending, startTransition] = useTransition();
  const [effectiveIsPlaying, setEffectiveIsPlaying] = useState(isPlaying);

  // Update effectiveIsPlaying with transition to avoid blocking UI
  useEffect(() => {
    startTransition(() => {
      setEffectiveIsPlaying(isPlaying);
    });
  }, [isPlaying]);

  // Pre-calculate full-resolution chart data (always available)
  const fullChartData = useMemo(() => {
    const out: any[] = [];
    const source = baseSnapshots.length > 0 ? baseSnapshots : simulationData;
    const n = source.length;
    if (n === 0) return out;

    for (let i = 0; i < n; i++) {
      const base = source[i] as any;
      out.push({
        index: i,
        ...base,
        price: priceHistory[i] ?? base.price,
      });
    }
    return out;
  }, [simulationData, baseSnapshots, baseSnapshotsVersion, priceHistoryVersion]);

  // Build chart data with sampling when playing (use effectiveIsPlaying to avoid blocking)
  const chartData = useMemo(() => {
    if (effectiveIsPlaying) {
      // When playing, sample heavily
      const sampleEvery = 10;
      const out: any[] = [];
      for (let i = 0; i < fullChartData.length; i += sampleEvery) {
        out.push(fullChartData[i]);
      }
      // Ensure last point included
      if (fullChartData.length > 0 && (fullChartData.length - 1) % sampleEvery !== 0) {
        out.push(fullChartData[fullChartData.length - 1]);
      }
      return out;
    }
    // When paused, use full resolution
    return fullChartData;
  }, [fullChartData, effectiveIsPlaying]);

  // Throttle chart data updates during simulation
  // Always call the hook (Rules of Hooks), but use delay=0 when not playing to return immediately
  const throttledChartData = useThrottle(chartData, effectiveIsPlaying ? 200 : 0);

  // Disable line animation entirely while simulation is playing to reduce CPU.
  const shouldAnimate = !effectiveIsPlaying;

  // Debounce demand pressure config to avoid recalculating on every change
  const debouncedDemandPressureConfig = useDebounce(demandPressureConfig, 500);

  // Use Web Worker for expensive calculations (only when not playing)
  // Delay enabling the worker slightly after pausing to avoid blocking the UI
  const [shouldCalculatePaths, setShouldCalculatePaths] = useState(!isPlaying);
  useEffect(() => {
    if (!isPlaying) {
      // Small delay after pausing before calculating paths
      const timer = setTimeout(() => setShouldCalculatePaths(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShouldCalculatePaths(false);
    }
  }, [isPlaying]);

  const { paths: potentialPaths } = usePricePathsWorker(
    config,
    debouncedDemandPressureConfig,
    simulationData.length > 0 ? simulationData.length - 1 : 0,
    [0.5, 1.0, 1.5],
    shouldCalculatePaths,
  );

  // Merge potential paths into chart data (only when not playing)
  const chartDataWithPaths = useMemo(() => {
    if (effectiveIsPlaying || potentialPaths.length === 0) {
      // When playing or paths not ready, don't include potential paths to reduce computation
      return throttledChartData;
    }
    return throttledChartData.map((data: any, i: number) => ({
      ...data,
      potentialPathLow: potentialPaths[0]?.[i] ?? null,
      potentialPathMedium: potentialPaths[1]?.[i] ?? null,
      potentialPathHigh: potentialPaths[2]?.[i] ?? null,
    }));
  }, [throttledChartData, potentialPaths, effectiveIsPlaying]);

  const demandChartData = useMemo(() => {
    return throttledChartData.map((d: any) => {
      const idx = d.index ?? 0;
      const buy = demandPressureCurve[idx] ?? 0;
      const sell = sellPressureCurve[idx] ?? 0;
      return {
        ...d,
        buyPressure: buy,
        sellPressure: sell,
        netPressure: buy - sell,
      };
    });
  }, [throttledChartData, demandPressureCurve, sellPressureCurve]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Tabs defaultValue="chart" className="w-full">
          <div className="flex items-center justify-between mb-2">
            <TabsList className="bg-transparent p-0 justify-start h-auto border-b w-full rounded-none">
              <TabsTrigger
                value="chart"
                className="rounded-none border-b-2 border-transparent data-[state=active]:shadow-none px-4 py-2"
              >
                Price over time
              </TabsTrigger>
              <TabsTrigger
                value="swaps"
                className="rounded-none border-b-2 border-transparent data-[state=active]:shadow-none px-4 py-2"
              >
                Sales
              </TabsTrigger>
              <TabsTrigger
                value="demand"
                className="rounded-none border-b-2 border-transparent  data-[state=active]:shadow-none px-4 py-2"
              >
                Demand curve
              </TabsTrigger>
              <TabsTrigger
                value="weights"
                className="rounded-none border-b-2 border-transparent data-[state=active]:shadow-none px-4 py-2"
              >
                Weights
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="border rounded-md bg-background/50 p-4 relative h-[600px]">
            <div className="mb-3 p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-md flex items-start gap-2">
              <svg
                className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-xs text-emerald-800 dark:text-emerald-200">
                <span className="font-semibold">Dynamic price:</span> Decays
                with time, rises with demand. Dotted lines show potential price
                paths based on different demand scenarios.
              </p>
            </div>
            <TabsContent value="chart" className="mt-0 h-[calc(100%-2rem)]">
              <PriceChartTab
                chartData={chartDataWithPaths}
                isPlaying={effectiveIsPlaying}
                shouldAnimate={shouldAnimate}
                simulationData={simulationData}
                currentStep={currentStep}
              />
            </TabsContent>

            <TabsContent value="swaps" className="mt-0 h-[calc(100%-2rem)]">
              <SwapsTab swaps={swaps} />
            </TabsContent>

            <TabsContent value="demand" className="mt-0 h-[calc(100%-2rem)]">
              <DemandChartTab
                chartData={demandChartData}
                shouldAnimate={shouldAnimate}
              />
            </TabsContent>

            <TabsContent value="weights" className="mt-0 h-[calc(100%-2rem)]">
              <WeightsChartTab
                chartData={chartData}
                shouldAnimate={shouldAnimate}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <div className="lg:col-span-1 flex">
        <SwapForm />
      </div>
    </div>
  );
}

export const SimulatorMain = memo(SimulatorMainComponent);
