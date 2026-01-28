"use client";

import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwapForm } from "./SwapForm";
import { useMemo, memo } from "react";
import { useDebounce } from "@/lib/useDebounce";
import { useThrottle } from "@/lib/useThrottle";
import { usePricePathsWorker } from "@/lib/hooks/usePricePathsWorker";
import { PriceChartTab } from "./tabs/PriceChartTab";
import { SwapsTab } from "./tabs/SwapsTab";
import { DemandChartTab } from "./tabs/DemandChartTab";
import { WeightsChartTab } from "./tabs/WeightsChartTab";

function SimulatorMainComponent() {
  const {
    simulationData,
    swaps,
    demandCurve,
    config,
    currentStep,
    simulationSpeed,
    demandPressureConfig,
    isPlaying,
  } = useSimulatorStore(
    useShallow((state) => ({
      simulationData: state.simulationData,
      swaps: state.swaps,
      demandCurve: state.demandCurve,
      config: state.config,
      currentStep: state.currentStep,
      simulationSpeed: state.simulationSpeed,
      demandPressureConfig: state.demandPressureConfig,
      isPlaying: state.isPlaying,
    })),
  );

  // Throttle chart data updates during simulation to reduce rendering overhead
  // Sample data points during simulation for better performance
  const chartData = useMemo(() => {
    if (!isPlaying) {
      return simulationData;
    }
    // During simulation, sample every 5th point to reduce rendering load
    return simulationData.filter(
      (_, index) => index % 5 === 0 || index === simulationData.length - 1,
    );
  }, [simulationData, isPlaying]);

  // Throttle chart data updates during simulation
  // Always call the hook (Rules of Hooks), but use delay=0 when not playing to return immediately
  const throttledChartData = useThrottle(chartData, isPlaying ? 200 : 0);

  // Disable animation when speed is high to ensure smooth updates
  const shouldAnimate = simulationSpeed <= 1;

  // Debounce demand pressure config to avoid recalculating on every change
  const debouncedDemandPressureConfig = useDebounce(demandPressureConfig, 500);

  // Use Web Worker for expensive calculations (only when not playing)
  // The hook now uses stable comparisons internally to prevent infinite loops
  const { paths: potentialPaths } = usePricePathsWorker(
    config,
    debouncedDemandPressureConfig,
    simulationData.length - 1,
    [0.5, 1.0, 1.5],
    !isPlaying, // Only calculate when simulation is paused
  );

  // Merge potential paths into chart data (only when not playing)
  const chartDataWithPaths = useMemo(() => {
    if (isPlaying || potentialPaths.length === 0) {
      // When playing or paths not ready, don't include potential paths to reduce computation
      return throttledChartData;
    }
    return throttledChartData.map((data: any, i: number) => ({
      ...data,
      potentialPathLow: potentialPaths[0]?.[i] ?? null,
      potentialPathMedium: potentialPaths[1]?.[i] ?? null,
      potentialPathHigh: potentialPaths[2]?.[i] ?? null,
    }));
  }, [throttledChartData, potentialPaths, isPlaying]);

  const demandChartData = useMemo(() => {
    return throttledChartData.map((d: any, i: number) => ({
      ...d,
      fairValue: demandCurve[i] || 0,
    }));
  }, [throttledChartData, demandCurve]);

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
                Fair price discovery
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
                isPlaying={isPlaying}
                shouldAnimate={shouldAnimate}
                simulationData={simulationData}
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
                chartData={simulationData}
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
