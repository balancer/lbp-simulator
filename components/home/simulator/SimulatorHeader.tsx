"use client";

import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useMemo, memo } from "react";
import { useShallow } from "zustand/react/shallow";
import Image from "next/image";

function SimulatorHeaderComponent() {
  const { config, currentUsdcBalance, currentStep, simulationData } =
    useSimulatorStore(
      useShallow((state) => ({
        config: state.config,
        currentUsdcBalance: state.currentUsdcBalance,
        currentStep: state.currentStep,
        simulationData: state.simulationData,
      })),
    );

  const timeRemaining = useMemo(() => {
    if (!simulationData || simulationData.length === 0) return "0d 0h";
    const currentStepData = simulationData[currentStep] || simulationData[0];
    const totalDurationHours = config.duration;
    const currentHour = currentStepData.time;
    const remainingHours = Math.max(0, totalDurationHours - currentHour);

    if (remainingHours >= 24) {
      const days = Math.floor(remainingHours / 24);
      const hours = Math.floor(remainingHours % 24);
      return `${days}d ${hours}h`;
    }
    const h = Math.floor(remainingHours);
    const m = Math.floor((remainingHours % 1) * 60);
    return `${h}h ${m}m`;
  }, [config.duration, currentStep, simulationData]);

  const totalRaised = currentUsdcBalance - config.usdcBalanceIn;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center font-bold">
          <Image src={"logo-balancer-black.svg"} alt="Balancer Logo" width={30} height={30} />
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

export const SimulatorHeader = memo(SimulatorHeaderComponent);
