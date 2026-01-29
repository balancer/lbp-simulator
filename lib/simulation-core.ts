import type { LBPConfig, DemandPressureConfig, SellPressureConfig } from "./lbp-math";

// Minimal snapshot shape that charts and store need per simulation step.
export interface SimulationStateSnapshot {
  index: number;
  time: number;
  timeLabel: string;
  price: number;
  tknBalance: number;
  usdcBalance: number;
  tknWeight: number;
  usdcWeight: number;
  communityTokensHeld: number;
  communityAvgCost: number;
  // Per-step bot trade volumes (community), for logging in the Sales table
  buyVolumeUSDC: number;
  buyVolumeTKN: number;
  sellVolumeUSDC: number;
  sellVolumeTKN: number;
}

// This file intentionally contains only types and shared interfaces for now.
// The heavy deterministic loop is implemented inside the simulation worker
// (public/workers/simulationWorker.js), which mirrors the math from lbp-math.ts.
// Keeping this file small and dependency-free makes it safe to import from both
// the store and UI components without pulling in worker-specific code.

