"use client";

import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";
import { TabsContent } from "@/components/ui/tabs";
import { useMemo, useEffect, useTransition, useState, memo } from "react";
import { useDebounce } from "@/lib/useDebounce";
import { useThrottle } from "@/lib/useThrottle";
import { usePricePathsWorker } from "@/lib/hooks/usePricePathsWorker";
import { PriceChartWithAnimation } from "./PriceChartWithAnimation";
import { SwapsTab } from "./tabs/SwapsTab";
import { DemandChartTab } from "./tabs/DemandChartTab";
import { WeightsChartTab } from "./tabs/WeightsChartTab";

/**
 * Isolated component that subscribes only to step-changing / chart-related store state.
 * Re-renders every step; parent SimulatorMain does not, so SwapForm and tab triggers stay stable.
 */
function SimulatorChartAreaComponent() {
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
    ethPriceUsd,
    currentTknBalance,
    currentUsdcBalance,
    communityTokensHeld,
    communityAvgCost,
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
      ethPriceUsd: state.ethPriceUsd,
      currentTknBalance: state.currentTknBalance,
      currentUsdcBalance: state.currentUsdcBalance,
      communityTokensHeld: state.communityTokensHeld,
      communityAvgCost: state.communityAvgCost,
    })),
  );

  const collateralUsd =
    config.collateralToken === "ETH" || config.collateralToken === "wETH"
      ? ethPriceUsd ?? 1
      : 1;

  const [effectiveIsPlaying, setEffectiveIsPlaying] = useState(isPlaying);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      setEffectiveIsPlaying(isPlaying);
    });
  }, [isPlaying]);

  const fullChartData = useMemo(() => {
    const out: any[] = [];
    const source = baseSnapshots.length > 0 ? baseSnapshots : simulationData;
    const n = source.length;
    if (n === 0) return out;
    for (let i = 0; i < n; i++) {
      const base = source[i] as any;
      const priceInCollateral = priceHistory[i] ?? base.price;
      out.push({
        index: i,
        ...base,
        price: priceInCollateral * collateralUsd,
      });
    }
    return out;
  }, [
    simulationData,
    baseSnapshots,
    baseSnapshotsVersion,
    priceHistoryVersion,
    collateralUsd,
  ]);

  const priceDomain = useMemo((): [number, number] | undefined => {
    if (fullChartData.length === 0) return undefined;
    const prices = fullChartData
      .map((d: any) => d.price)
      .filter((p: any) => typeof p === "number" && !Number.isNaN(p));
    if (prices.length === 0) return undefined;
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP;
    const padding = range > 0 ? range * 0.05 : minP * 0.01 || 0.01;
    return [Math.max(0, minP - padding), maxP + padding];
  }, [fullChartData]);

  const chartData = useMemo(() => {
    if (effectiveIsPlaying) {
      const sampleEvery = 10;
      const out: any[] = [];
      for (let i = 0; i < fullChartData.length; i += sampleEvery) {
        out.push(fullChartData[i]);
      }
      if (
        fullChartData.length > 0 &&
        (fullChartData.length - 1) % sampleEvery !== 0
      ) {
        out.push(fullChartData[fullChartData.length - 1]);
      }
      return out;
    }
    return fullChartData;
  }, [fullChartData, effectiveIsPlaying]);

  const throttledChartData = useThrottle(
    chartData,
    effectiveIsPlaying ? 200 : 0,
  );
  const shouldAnimate = !effectiveIsPlaying;

  const debouncedDemandPressureConfig = useDebounce(demandPressureConfig, 500);
  const [shouldCalculatePaths, setShouldCalculatePaths] = useState(!isPlaying);
  useEffect(() => {
    if (!isPlaying) {
      const timer = setTimeout(() => setShouldCalculatePaths(true), 100);
      return () => clearTimeout(timer);
    }
    setShouldCalculatePaths(false);
  }, [isPlaying]);

  // Build the current-step state for the worker so that potential
  // paths start exactly from the live pool balances at the pause point.
  const currentSnapshot =
    baseSnapshots.length > 0
      ? baseSnapshots[Math.min(currentStep, baseSnapshots.length - 1)]
      : null;

  const startState =
    currentSnapshot !== null
      ? {
          tknBalance: currentTknBalance,
          usdcBalance: currentUsdcBalance,
          tknWeight: currentSnapshot.tknWeight,
          usdcWeight: currentSnapshot.usdcWeight,
          communityTokensHeld,
          communityAvgCost,
        }
      : null;

  const { paths: potentialPaths } = usePricePathsWorker(
    config,
    debouncedDemandPressureConfig,
    sellPressureConfig,
    simulationData.length > 0 ? simulationData.length - 1 : 0,
    [0, 1, 2],
    shouldCalculatePaths,
    currentStep,
    startState,
  );

  const fullChartDataWithPaths = useMemo(() => {
    if (effectiveIsPlaying || potentialPaths.length === 0) {
      return fullChartData;
    }

    const startIndex = currentStep;

    return fullChartData.map((data: any, i: number) => {
      const localIdx = i - startIndex;
      let low = localIdx >= 0 ? potentialPaths[0]?.[localIdx] : null;
      let med = localIdx >= 0 ? potentialPaths[1]?.[localIdx] : null;
      let high = localIdx >= 0 ? potentialPaths[2]?.[localIdx] : null;

      // Ensure that all three potential paths are visually connected
      // to the current price at the pause point. The worker does not
      // incorporate past sell pressure, so its first value at the
      // current step may differ slightly from the main simulated price.
      // For the junction, we anchor all three potential paths to the
      // current spot price so the solid and dashed lines meet.
      if (localIdx === 0) {
        const priceInCollateral = data.price / collateralUsd;
        low = priceInCollateral;
        med = priceInCollateral;
        high = priceInCollateral;
      }

      return {
        ...data,
        potentialPathLow: typeof low === "number" ? low * collateralUsd : null,
        potentialPathMedium:
          typeof med === "number" ? med * collateralUsd : null,
        potentialPathHigh:
          typeof high === "number" ? high * collateralUsd : null,
      };
    });
  }, [
    fullChartData,
    potentialPaths,
    effectiveIsPlaying,
    collateralUsd,
    currentStep,
  ]);

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
    <>
      <TabsContent value="chart" className="mt-0 h-[calc(100%-2rem)]">
        <PriceChartWithAnimation
          chartData={fullChartDataWithPaths}
          priceDomain={priceDomain}
          simulationData={simulationData}
          isPlaying={effectiveIsPlaying}
          shouldAnimate={shouldAnimate}
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
          currentStep={currentStep}
        />
      </TabsContent>
    </>
  );
}

export const SimulatorChartArea = memo(SimulatorChartAreaComponent);
