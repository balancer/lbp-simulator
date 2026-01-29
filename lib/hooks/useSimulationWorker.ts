import { useState, useEffect, useRef } from "react";
import type {
  LBPConfig,
  DemandPressureConfig,
  SellPressureConfig,
} from "../lbp-math";
import type { SimulationStateSnapshot } from "../simulation-core";

interface WorkerMessage {
  type: "run-simulation";
  config: LBPConfig;
  demandPressureConfig: DemandPressureConfig;
  sellPressureConfig: SellPressureConfig;
  steps: number;
}

interface WorkerResponse {
  type: "success" | "error";
  result?: SimulationStateSnapshot[];
  error?: string;
}

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

function createDemandKey(config: DemandPressureConfig): string {
  return JSON.stringify({
    preset: config.preset,
    magnitudeBase: config.magnitudeBase,
    multiplier: config.multiplier,
  });
}

function createSellKey(config: SellPressureConfig): string {
  return JSON.stringify({
    preset: config.preset,
    loyalSoldPct: config.loyalSoldPct,
    loyalConcentrationPct: config.loyalConcentrationPct,
    greedySpreadPct: config.greedySpreadPct,
    greedySellPct: config.greedySellPct,
  });
}

export function useSimulationWorker(
  config: LBPConfig,
  demandPressureConfig: DemandPressureConfig,
  sellPressureConfig: SellPressureConfig,
  steps: number,
  enabled: boolean = true,
) {
  const [snapshots, setSnapshots] = useState<SimulationStateSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const lastConfigKeyRef = useRef("");
  const lastDemandKeyRef = useRef("");
  const lastSellKeyRef = useRef("");
  const lastStepsRef = useRef(-1);
  const lastEnabledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      workerRef.current = new Worker("/workers/simulationWorker.js", {
        type: "module",
      });

      workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { type, result, error: errorMsg } = e.data;
        if (type === "success" && result) {
          setSnapshots(result);
          setIsLoading(false);
          setError(null);
        } else if (type === "error") {
          setError(errorMsg || "Unknown simulation error");
          setIsLoading(false);
        }
      };

      workerRef.current.onerror = (err) => {
        console.error("Simulation worker error:", err);
        setError("Simulation worker error");
        setIsLoading(false);
      };
    } catch (err) {
      console.error("Failed to create simulation worker:", err);
      setError("Failed to initialize simulation worker");
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const configKey = createConfigKey(config);
    const demandKey = createDemandKey(demandPressureConfig);
    const sellKey = createSellKey(sellPressureConfig);

    if (
      configKey === lastConfigKeyRef.current &&
      demandKey === lastDemandKeyRef.current &&
      sellKey === lastSellKeyRef.current &&
      steps === lastStepsRef.current &&
      enabled === lastEnabledRef.current
    ) {
      return;
    }

    lastConfigKeyRef.current = configKey;
    lastDemandKeyRef.current = demandKey;
    lastSellKeyRef.current = sellKey;
    lastStepsRef.current = steps;
    lastEnabledRef.current = enabled;

    if (!enabled || !workerRef.current) {
      setSnapshots([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    const message: WorkerMessage = {
      type: "run-simulation",
      config,
      demandPressureConfig,
      sellPressureConfig,
      steps,
    };

    workerRef.current.postMessage(message);

    const timeoutId = setTimeout(() => {
      if (currentRequestId === requestIdRef.current) {
        setError("Simulation timeout");
        setIsLoading(false);
      }
    }, 30000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [config, demandPressureConfig, sellPressureConfig, steps, enabled]);

  return { snapshots, isLoading, error };
}

