/**
 * Real LBP Comparison Tool
 *
 * Use this to validate your simulation against real, historical LBP data.
 * Input real LBP parameters and observed outcomes, and this tool will
 * run your simulation and compare the results.
 */

import type {
  LBPConfig,
  DemandPressureConfig,
  SellPressureConfig,
} from "../lib/lbp-math";
import { runDeterministicSimulation } from "../public/workers/simulation-runner.js";

export interface RealLBPData {
  name: string;
  // Input parameters
  config: LBPConfig;

  // Observed outcomes from the real LBP
  observed: {
    totalRaised: number; // Total USDC/collateral raised
    finalPrice?: number; // Final price (if known)
    averagePrice?: number; // Average sale price (if known)
    tokensSold?: number; // Total tokens sold (if known)
    duration?: number; // Actual duration in hours (if different from planned)

    // Optional: price trajectory data points
    pricePoints?: Array<{
      time: number; // Hours from start
      price: number; // Price at that time
    }>;
  };
}

export interface ComparisonResult {
  name: string;
  metrics: {
    totalRaised: {
      simulated: number;
      observed: number;
      difference: number;
      percentError: number;
    };
    finalPrice?: {
      simulated: number;
      observed: number;
      difference: number;
      percentError: number;
    };
    averagePrice?: {
      simulated: number;
      observed: number;
      difference: number;
      percentError: number;
    };
    tokensSold?: {
      simulated: number;
      observed: number;
      difference: number;
      percentError: number;
    };
  };
  priceTrajectoryComparison?: Array<{
    time: number;
    simulatedPrice: number;
    observedPrice: number;
    error: number;
  }>;
  passed: boolean;
  tolerance: number; // Acceptable error percentage (default 10%)
}

/**
 * Compare simulation results with real LBP data
 */
export async function compareWithRealLBP(
  realData: RealLBPData,
  demandConfig: DemandPressureConfig,
  sellConfig: SellPressureConfig,
  tolerance: number = 0.1, // 10% default tolerance
): Promise<ComparisonResult> {
  // Run simulation: use in-process runner in Node (same as integration tests), Worker in browser
  let snapshots: Array<Record<string, unknown>>;
  if (typeof Worker === "undefined") {
    snapshots = runDeterministicSimulation(
      realData.config,
      demandConfig,
      sellConfig,
      100,
    );
  } else {
    const worker = new Worker(
      new URL("./simulationWorker.js", import.meta.url),
    );
    snapshots = await new Promise<Array<Record<string, unknown>>>(
      (resolve, reject) => {
        worker.onmessage = (
          e: MessageEvent<{ type: string; result?: unknown; error?: string }>,
        ) => {
          if (e.data.type === "success") {
            resolve(e.data.result as Array<Record<string, unknown>>);
          } else {
            reject(new Error(e.data.error));
          }
        };
        worker.postMessage({
          type: "run-simulation",
          config: realData.config,
          demandPressureConfig: demandConfig,
          sellPressureConfig: sellConfig,
          steps: 100,
        });
      },
    );
    worker.terminate();
  }

  // Calculate simulated metrics
  const finalSnapshot = snapshots[snapshots.length - 1];
  const initialUSDC = realData.config.usdcBalanceIn;

  const simulatedTotalRaised =
    (finalSnapshot.usdcBalance as number) - initialUSDC;
  const simulatedFinalPrice = finalSnapshot.price as number;
  const simulatedTokensSold =
    realData.config.tknBalanceIn - (finalSnapshot.tknBalance as number);

  // Average price = sum(buyVolumeUSDC) / sum(buyVolumeTKN). Valid only if (1) buy volumes
  // are recorded consistently per step, and (2) buyVolumeTKN is token-out to buyers (not net of sells).
  let totalUSDCSpent = 0;
  let totalTokensBought = 0;
  for (const snapshot of snapshots) {
    totalUSDCSpent += (snapshot.buyVolumeUSDC as number) ?? 0;
    totalTokensBought += (snapshot.buyVolumeTKN as number) ?? 0;
  }
  const simulatedAveragePrice =
    totalTokensBought > 0 ? totalUSDCSpent / totalTokensBought : 0;

  // Build comparison metrics
  const metrics: ComparisonResult["metrics"] = {
    totalRaised: {
      simulated: simulatedTotalRaised,
      observed: realData.observed.totalRaised,
      difference: simulatedTotalRaised - realData.observed.totalRaised,
      percentError:
        Math.abs(simulatedTotalRaised - realData.observed.totalRaised) /
        realData.observed.totalRaised,
    },
  };

  if (realData.observed.finalPrice !== undefined) {
    metrics.finalPrice = {
      simulated: simulatedFinalPrice,
      observed: realData.observed.finalPrice,
      difference: simulatedFinalPrice - realData.observed.finalPrice,
      percentError:
        Math.abs(simulatedFinalPrice - realData.observed.finalPrice) /
        realData.observed.finalPrice,
    };
  }

  if (realData.observed.averagePrice !== undefined) {
    metrics.averagePrice = {
      simulated: simulatedAveragePrice,
      observed: realData.observed.averagePrice,
      difference: simulatedAveragePrice - realData.observed.averagePrice,
      percentError:
        Math.abs(simulatedAveragePrice - realData.observed.averagePrice) /
        realData.observed.averagePrice,
    };
  }

  if (realData.observed.tokensSold !== undefined) {
    metrics.tokensSold = {
      simulated: simulatedTokensSold,
      observed: realData.observed.tokensSold,
      difference: simulatedTokensSold - realData.observed.tokensSold,
      percentError:
        Math.abs(simulatedTokensSold - realData.observed.tokensSold) /
        realData.observed.tokensSold,
    };
  }

  // Price trajectory comparison
  let priceTrajectoryComparison: ComparisonResult["priceTrajectoryComparison"];
  if (
    realData.observed.pricePoints &&
    realData.observed.pricePoints.length > 0
  ) {
    priceTrajectoryComparison = realData.observed.pricePoints.map((point) => {
      // Find closest simulated snapshot
      const stepIndex = Math.round(
        (point.time / realData.config.duration) * 100,
      );
      const simulatedSnapshot =
        snapshots[Math.min(stepIndex, snapshots.length - 1)];

      return {
        time: point.time,
        simulatedPrice: simulatedSnapshot.price as number,
        observedPrice: point.price,
        error:
          Math.abs((simulatedSnapshot.price as number) - point.price) /
          point.price,
      };
    });
  }

  // Determine if comparison passed
  const errors = [
    metrics.totalRaised.percentError,
    metrics.finalPrice?.percentError,
    metrics.averagePrice?.percentError,
    metrics.tokensSold?.percentError,
  ].filter((e): e is number => e !== undefined);

  const maxError = Math.max(...errors);
  const passed = maxError <= tolerance;

  return {
    name: realData.name,
    metrics,
    priceTrajectoryComparison,
    passed,
    tolerance,
  };
}

/**
 * Print comparison results in a readable format
 */
export function printComparisonResults(result: ComparisonResult): void {
  console.log("\n" + "=".repeat(60));
  console.log(`📊 Comparison: ${result.name}`);
  console.log("=".repeat(60));

  console.log("\n💰 Total Raised:");
  console.log(
    `   Observed:  $${result.metrics.totalRaised.observed.toLocaleString()}`,
  );
  console.log(
    `   Simulated: $${result.metrics.totalRaised.simulated.toLocaleString()}`,
  );
  console.log(
    `   Error:     ${(result.metrics.totalRaised.percentError * 100).toFixed(
      2,
    )}%`,
  );

  if (result.metrics.finalPrice) {
    console.log("\n📈 Final Price:");
    console.log(
      `   Observed:  $${result.metrics.finalPrice.observed.toFixed(4)}`,
    );
    console.log(
      `   Simulated: $${result.metrics.finalPrice.simulated.toFixed(4)}`,
    );
    console.log(
      `   Error:     ${(result.metrics.finalPrice.percentError * 100).toFixed(
        2,
      )}%`,
    );
  }

  if (result.metrics.averagePrice) {
    console.log("\n📊 Average Price:");
    console.log(
      `   Observed:  $${result.metrics.averagePrice.observed.toFixed(4)}`,
    );
    console.log(
      `   Simulated: $${result.metrics.averagePrice.simulated.toFixed(4)}`,
    );
    console.log(
      `   Error:     ${(result.metrics.averagePrice.percentError * 100).toFixed(
        2,
      )}%`,
    );
  }

  if (result.metrics.tokensSold) {
    console.log("\n🪙 Tokens Sold:");
    console.log(
      `   Observed:  ${result.metrics.tokensSold.observed.toLocaleString()}`,
    );
    console.log(
      `   Simulated: ${result.metrics.tokensSold.simulated.toLocaleString()}`,
    );
    console.log(
      `   Error:     ${(result.metrics.tokensSold.percentError * 100).toFixed(
        2,
      )}%`,
    );
  }

  if (
    result.priceTrajectoryComparison &&
    result.priceTrajectoryComparison.length > 0
  ) {
    console.log("\n📉 Price Trajectory Comparison:");
    result.priceTrajectoryComparison.forEach((point) => {
      console.log(
        `   ${point.time}h: Observed=$${point.observedPrice.toFixed(
          4,
        )}, Simulated=$${point.simulatedPrice.toFixed(4)}, Error=${(
          point.error * 100
        ).toFixed(2)}%`,
      );
    });
  }

  console.log("\n" + "=".repeat(60));
  if (result.passed) {
    console.log(
      `✅ PASSED (tolerance: ${(result.tolerance * 100).toFixed(0)}%)`,
    );
  } else {
    console.log(
      `❌ FAILED (tolerance: ${(result.tolerance * 100).toFixed(0)}%)`,
    );
  }
  console.log("=".repeat(60) + "\n");
}

/**
 * Example: PERP Protocol LBP validation
 */
export const PERP_LBP: RealLBPData = {
  name: "PERP Protocol (Dec 2020)",
  config: {
    tokenName: "Perpetual Protocol",
    tokenSymbol: "PERP",
    totalSupply: 150000000,
    percentForSale: 5,
    collateralToken: "USDC",
    tknBalanceIn: 7500000,
    tknWeightIn: 96,
    usdcBalanceIn: 200000,
    usdcWeightIn: 4,
    tknWeightOut: 25,
    usdcWeightOut: 75,
    startDelay: 0,
    duration: 72,
    swapFee: 0.01,
    creatorFee: 0,
  },
  observed: {
    totalRaised: 1800000,
    averagePrice: 0.24,
    // tokensSold: 7500000, // Approximate
  },
};

/**
 * Example: APWine LBP validation
 */
export const APWINE_LBP: RealLBPData = {
  name: "APWine (Mar 2021)",
  config: {
    tokenName: "APWine",
    tokenSymbol: "APW",
    totalSupply: 50000000,
    percentForSale: 10,
    collateralToken: "USDC",
    tknBalanceIn: 5000000,
    tknWeightIn: 90,
    usdcBalanceIn: 500000,
    usdcWeightIn: 10,
    tknWeightOut: 30,
    usdcWeightOut: 70,
    startDelay: 0,
    duration: 48,
    swapFee: 0.01,
    creatorFee: 0,
  },
  observed: {
    totalRaised: 2300000,
    // averagePrice: ~$0.46,
  },
};

/**
 * Usage example:
 *
 * ```typescript
 * import { compareWithRealLBP, printComparisonResults, PERP_LBP } from './compare-real-lbp';
 *
 * const demandConfig = {
 *   preset: 'bullish',
 *   magnitudeBase: 1000000,
 *   multiplier: 1.8,
 * };
 *
 * const sellConfig = {
 *   preset: 'loyal',
 *   loyalSoldPct: 3,
 *   loyalConcentrationPct: 50,
 *   greedySpreadPct: 2,
 *   greedySellPct: 100,
 * };
 *
 * const result = await compareWithRealLBP(PERP_LBP, demandConfig, sellConfig);
 * printComparisonResults(result);
 * ```
 */

/** Run when this file is executed directly (e.g. npx tsx test/compare-real-lbp.ts) */
async function main(): Promise<void> {
  const demandConfig = {
    preset: "bullish" as const,
    magnitudeBase: 1_000_000 as const,
    multiplier: 3,
  };
  const sellConfig = {
    preset: "loyal" as const,
    loyalSoldPct: 3,
    loyalConcentrationPct: 50,
    greedySpreadPct: 2,
    greedySellPct: 100,
  };

  console.log("Running PERP LBP comparison...\n");
  const result = await compareWithRealLBP(APWINE_LBP, demandConfig, sellConfig);
  printComparisonResults(result);
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1]?.includes("compare-real-lbp");
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
