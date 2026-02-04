// Web Worker for calculating potential price paths.
// Delegates to shared simulation-runner logic for consistency.

import { calculatePotentialPricePaths } from "./simulation-runner.js";

self.onmessage = function (e) {
  if (e.data.type === "calculate") {
    try {
      const result = calculatePotentialPricePaths(
        e.data.config,
        e.data.demandPressureConfig,
        e.data.sellPressureConfig ?? {
          preset: "loyal",
          loyalSoldPct: 5,
          loyalConcentrationPct: 60,
          greedySpreadPct: 2,
          greedySellPct: 100,
        },
        e.data.steps,
        e.data.scenarios,
        e.data.currentStep ?? 0,
        e.data.currentStepState ?? null,
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
