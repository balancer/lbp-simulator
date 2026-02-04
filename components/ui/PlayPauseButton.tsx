"use client";

import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";

const SPEED_OPTIONS = [1, 5, 10] as const;

export function PlayPauseButton() {
  const pathname = usePathname();
  const {
    isPlaying,
    setIsPlaying,
    simulationSpeed,
    setSimulationSpeed,
    restartSimulation,
  } = useSimulatorStore(
    useShallow((state) => ({
      isPlaying: state.isPlaying,
      setIsPlaying: state.setIsPlaying,
      simulationSpeed: state.simulationSpeed,
      setSimulationSpeed: state.setSimulationSpeed,
      restartSimulation: state.restartSimulation,
    })),
  );

  // Only re-compute / re-render when the finished status actually changes,
  // not on every single step while the simulation is running.
  const isFinished = useSimulatorStore((state) => {
    return state.totalSteps > 0 && state.currentStep >= state.totalSteps - 1;
  });

  const handleMainButtonClick = () => {
    if (isFinished) {
      restartSimulation();
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSpeedClick = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(
      simulationSpeed as (typeof SPEED_OPTIONS)[number],
    );
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    setSimulationSpeed(SPEED_OPTIONS[nextIndex]);
  };

  if (!pathname?.startsWith("/lbp-simulator")) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
      {/* Play/Pause button */}
      <div className="relative">
        {/* Pulsing blur effect when simulation is running */}
        {isPlaying && (
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200 opacity-30 blur-xl animate-pulse"
            style={{
              width: "80px",
              height: "80px",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
        <Button
          onClick={handleMainButtonClick}
          size="icon"
          className="relative h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200 hover:from-blue-300 hover:via-purple-300 hover:to-orange-300 text-slate-900 font-semibold"
          aria-label={
            isFinished
              ? "Restart simulation"
              : isPlaying
              ? "Pause simulation"
              : "Play simulation"
          }
        >
          {isFinished ? (
            <RotateCcw className="h-6 w-6" />
          ) : isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6 ml-1" />
          )}
        </Button>
      </div>

      {/* Restart & Speed buttons */}
      <div className="flex items-center gap-2">
        <Button
          onClick={restartSimulation}
          variant="outline"
          size="sm"
          className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border-border/60 shadow-md hover:bg-background p-0"
          aria-label="Restart simulation"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleSpeedClick}
          variant="outline"
          size="sm"
          className="h-8 w-14 rounded-full bg-background/80 backdrop-blur-sm border-border/60 shadow-md hover:bg-background text-sm font-medium"
          aria-label={`Simulation speed: ${simulationSpeed}x`}
        >
          {simulationSpeed}x
        </Button>
      </div>
    </div>
  );
}
