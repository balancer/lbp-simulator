import { useState, useEffect, useRef } from "react";
import type {
  LBPConfig,
  DemandPressureConfig,
  SellPressureConfig,
} from "../lbp-math";

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
    preset: config.preset,
    magnitudeBase: config.magnitudeBase,
    multiplier: config.multiplier,
  });
}

function createSellConfigKey(config: SellPressureConfig): string {
  return JSON.stringify({
    preset: config.preset,
    loyalSoldPct: config.loyalSoldPct,
    loyalConcentrationPct: config.loyalConcentrationPct,
    greedySpreadPct: config.greedySpreadPct,
    greedySellPct: config.greedySellPct,
  });
}

interface StartState {
  tknBalance: number;
  usdcBalance: number;
  tknWeight: number;
  usdcWeight: number;
  communityTokensHeld: number;
  communityAvgCost: number;
}

interface WorkerMessage {
  type: "calculate";
  config: LBPConfig;
  demandPressureConfig: DemandPressureConfig;
  sellPressureConfig: SellPressureConfig;
  steps: number;
  scenarios: number[];
  currentStep: number;
  currentStepState: StartState | null;
}

interface WorkerResponse {
  type: "success" | "error";
  result?: number[][];
  error?: string;
}

export function usePricePathsWorker(
  config: LBPConfig,
  demandPressureConfig: DemandPressureConfig,
  sellPressureConfig: SellPressureConfig,
  steps: number,
  scenarios: number[] = [0, 1, 2],
  enabled: boolean = true,
  currentStep: number = 0,
  currentStepState: StartState | null = null,
) {
  const [paths, setPaths] = useState<number[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<number>(0);
  const lastConfigKeyRef = useRef<string>("");
  const lastDemandConfigKeyRef = useRef<string>("");
  const lastSellConfigKeyRef = useRef<string>("");
  const lastStepsRef = useRef<number>(-1);
  const lastEnabledRef = useRef<boolean>(false);
  const currentStepRef = useRef<number>(0);
  const lastStartStateKeyRef = useRef<string>("");

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
    const sellConfigKey = createSellConfigKey(sellPressureConfig);
    const startStateKey = currentStepState
      ? JSON.stringify(currentStepState)
      : "";

    // Only recalculate if something actually changed
    if (
      configKey === lastConfigKeyRef.current &&
      demandConfigKey === lastDemandConfigKeyRef.current &&
      sellConfigKey === lastSellConfigKeyRef.current &&
      steps === lastStepsRef.current &&
      enabled === lastEnabledRef.current &&
      currentStep === currentStepRef.current &&
      startStateKey === lastStartStateKeyRef.current
    ) {
      return; // No changes, skip recalculation
    }

    // Update refs
    lastConfigKeyRef.current = configKey;
    lastDemandConfigKeyRef.current = demandConfigKey;
    lastSellConfigKeyRef.current = sellConfigKey;
    lastStepsRef.current = steps;
    lastEnabledRef.current = enabled;
    currentStepRef.current = currentStep;
    lastStartStateKeyRef.current = startStateKey;

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
      sellPressureConfig,
      steps,
      scenarios,
      currentStep,
      currentStepState,
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
  }, [
    config,
    demandPressureConfig,
    sellPressureConfig,
    steps,
    scenarios,
    enabled,
    currentStep,
    currentStepState,
  ]);

  return { paths, isLoading, error };
}
