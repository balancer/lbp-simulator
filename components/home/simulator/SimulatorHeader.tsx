"use client";

import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useMemo } from "react";

export function SimulatorHeader() {
  const { config, currentUsdcBalance, currentStep, simulationData } =
    useSimulatorStore();

  const timeRemaining = useMemo(() => {
    // config.duration is in Days
    // progress = currentStep / (totalSteps)
    // remaining = duration * (1 - progress)
    // Let's assume simulationData is the source of truth for "Time"
    // But wait, step 0 is t=0.
    // duration is total days.
    // We can just calculate directly from step count/total if we expose totalSteps,
    // or look at the last datapoint time vs current datapoint time

    if (!simulationData || simulationData.length === 0) return "00:00:00";
    const endStep = simulationData[simulationData.length - 1];
    const currentStepData = simulationData[currentStep] || simulationData[0];

    const totalDurationDays = config.duration;
    const currentDay = currentStepData.time;
    const remainingDays = Math.max(0, totalDurationDays - currentDay);

    // Convert days to HH:MM:SS
    const totalSeconds = remainingDays * 24 * 60 * 60;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, [config.duration, currentStep, simulationData]);

  const totalRaised = currentUsdcBalance - config.usdcBalanceIn;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
          {config.tokenSymbol.slice(0, 1)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">
              ${config.tokenSymbol} token sale
            </h2>
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0"
            >
              Live
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Sale #1 • Starts Now</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Time Remaining
          </span>
          <div className="flex items-center gap-1.5 text-lg font-mono font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{timeRemaining}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total Raised
          </span>
          <span className="text-lg font-mono font-medium">
            $
            {totalRaised.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
