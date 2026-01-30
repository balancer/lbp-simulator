"use client";

import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, memo } from "react";
import { useSimulationWorker } from "@/lib/hooks/useSimulationWorker";
import { SimulatorChartArea } from "./SimulatorChartArea";

/**
 * Chart area shell; subscribes only to static/slow-changing state (config, etc.).
 * SwapForm is rendered as a sibling in Simulator so it never re-renders when this re-renders.
 */
function SimulatorMainComponent() {
  const {
    config,
    simulationData,
    demandPressureConfig,
    sellPressureConfig,
  } = useSimulatorStore(
    useShallow((state) => ({
      config: state.config,
      simulationData: state.simulationData,
      demandPressureConfig: state.demandPressureConfig,
      sellPressureConfig: state.sellPressureConfig,
    })),
  );

  const { snapshots: workerSnapshots } = useSimulationWorker(
    config,
    demandPressureConfig,
    sellPressureConfig,
    simulationData.length > 0 ? simulationData.length - 1 : 0,
    true,
  );

  const setBaseSnapshots = useSimulatorStore((state) => state.setBaseSnapshots);
  useEffect(() => {
    if (workerSnapshots && workerSnapshots.length > 0) {
      setBaseSnapshots(workerSnapshots);
    }
  }, [workerSnapshots, setBaseSnapshots]);

  return (
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

      <div className="border rounded-md bg-background/50 p-4 relative h-[560px]">
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
        <SimulatorChartArea />
      </div>
    </Tabs>
  );
}

export const SimulatorMain = memo(SimulatorMainComponent);
