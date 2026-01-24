"use client";

import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { useSimulatorStore } from "@/store/useSimulatorStore";

export function PlayPauseButton() {
  const { isPlaying, setIsPlaying } = useSimulatorStore();

  return (
    <div className="fixed bottom-6 right-6 z-50">
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
  );
}
