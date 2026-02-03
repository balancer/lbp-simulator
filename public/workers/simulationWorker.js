// Web Worker: thin wrapper around deterministic LBP simulation.
// Simulation logic lives in simulation-runner.js so tests can run it in-process.

import { runDeterministicSimulation } from "./simulation-runner.js";

self.onmessage = function (e) {
  if (e.data.type === "run-simulation") {
    try {
      const { config, demandPressureConfig, sellPressureConfig, steps } =
        e.data;
      const result = runDeterministicSimulation(
        config,
        demandPressureConfig,
        sellPressureConfig,
        steps,
      );
      self.postMessage({ type: "success", result });
    } catch (error) {
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
