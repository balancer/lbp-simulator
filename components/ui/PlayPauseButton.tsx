"use client";

import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";

const SPEED_OPTIONS = [1, 5, 10] as const;

export function PlayPauseButton() {
  const { isPlaying, setIsPlaying, simulationSpeed, setSimulationSpeed } =
    useSimulatorStore(
      useShallow((state) => ({
        isPlaying: state.isPlaying,
        setIsPlaying: state.setIsPlaying,
        simulationSpeed: state.simulationSpeed,
        setSimulationSpeed: state.setSimulationSpeed,
      })),
    );

  const handleSpeedClick = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(
      simulationSpeed as (typeof SPEED_OPTIONS)[number],
    );
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    setSimulationSpeed(SPEED_OPTIONS[nextIndex]);
  };

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
          onClick={() => setIsPlaying(!isPlaying)}
          size="icon"
          className="relative h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200 hover:from-blue-300 hover:via-purple-300 hover:to-orange-300 text-slate-900 font-semibold"
          aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6 ml-1" />
          )}
        </Button>
      </div>

      {/* Speed button */}
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
  );
}
