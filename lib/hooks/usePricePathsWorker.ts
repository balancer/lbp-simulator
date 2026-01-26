import { useState, useEffect, useRef } from "react";
import type { LBPConfig, DemandPressureConfig } from "../lbp-math";

// Helper to create stable string representation for comparison
function createConfigKey(config: LBPConfig): string {
  return JSON.stringify({
    tokenName: config.tokenName,
    tokenSymbol: config.tokenSymbol,
    totalSupply: config.totalSupply,
    percentForSale: config.percentForSale,
    tknBalanceIn: config.tknBalanceIn,
    tknWeightIn: config.tknWeightIn,
    usdcBalanceIn: config.usdcBalanceIn,
    usdcWeightIn: config.usdcWeightIn,
    tknWeightOut: config.tknWeightOut,
    usdcWeightOut: config.usdcWeightOut,
    startDelay: config.startDelay,
    duration: config.duration,
    swapFee: config.swapFee,
    creatorFee: config.creatorFee,
  });
}

function createDemandConfigKey(config: DemandPressureConfig): string {
  return JSON.stringify({
    baseIntensity: config.baseIntensity,
    floorIntensity: config.floorIntensity,
    growthRate: config.growthRate,
    priceDiscountMultiplier: config.priceDiscountMultiplier,
    baseTradeSize: config.baseTradeSize,
    tradeSizeVariation: config.tradeSizeVariation,
  });
}

interface WorkerMessage {
  type: "calculate";
  config: LBPConfig;
  demandPressureConfig: DemandPressureConfig;
  steps: number;
  scenarios: number[];
}

interface WorkerResponse {
  type: "success" | "error";
  result?: number[][];
  error?: string;
}

export function usePricePathsWorker(
  config: LBPConfig,
  demandPressureConfig: DemandPressureConfig,
  steps: number,
  scenarios: number[] = [0.5, 1.0, 1.5],
  enabled: boolean = true,
) {
  const [paths, setPaths] = useState<number[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<number>(0);
  const lastConfigKeyRef = useRef<string>("");
  const lastDemandConfigKeyRef = useRef<string>("");
  const lastStepsRef = useRef<number>(-1);
  const lastEnabledRef = useRef<boolean>(false);

  // Initialize worker
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      // Create worker from the public folder
      workerRef.current = new Worker("/workers/pricePathsWorker.js", {
        type: "module",
      });

      workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { type, result, error: errorMsg } = e.data;
        if (type === "success" && result) {
          setPaths(result);
          setIsLoading(false);
          setError(null);
        } else if (type === "error") {
          setError(errorMsg || "Unknown error");
          setIsLoading(false);
        }
      };

      workerRef.current.onerror = (err) => {
        setError("Worker error occurred");
        setIsLoading(false);
        console.error("Worker error:", err);
      };
    } catch (err) {
      console.error("Failed to create worker:", err);
      setError("Failed to initialize worker");
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Calculate paths when dependencies change (using stable keys to prevent infinite loops)
  useEffect(() => {
    const configKey = createConfigKey(config);
    const demandConfigKey = createDemandConfigKey(demandPressureConfig);
    const scenariosKey = JSON.stringify(scenarios);

    // Only recalculate if something actually changed
    if (
      configKey === lastConfigKeyRef.current &&
      demandConfigKey === lastDemandConfigKeyRef.current &&
      steps === lastStepsRef.current &&
      enabled === lastEnabledRef.current
    ) {
      return; // No changes, skip recalculation
    }

    // Update refs
    lastConfigKeyRef.current = configKey;
    lastDemandConfigKeyRef.current = demandConfigKey;
    lastStepsRef.current = steps;
    lastEnabledRef.current = enabled;

    if (!enabled || !workerRef.current) {
      setPaths([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    const message: WorkerMessage = {
      type: "calculate",
      config,
      demandPressureConfig,
      steps,
      scenarios,
    };

    workerRef.current.postMessage(message);

    // Timeout check to ensure we don't wait forever
    const timeoutId = setTimeout(() => {
      if (currentRequestId === requestIdRef.current) {
        setError("Calculation timeout");
        setIsLoading(false);
      }
    }, 30000); // 30 second timeout

    return () => {
      clearTimeout(timeoutId);
    };
  }, [config, demandPressureConfig, steps, scenarios, enabled]);

  return { paths, isLoading, error };
}
