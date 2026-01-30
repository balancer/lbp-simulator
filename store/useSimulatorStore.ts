import { create } from "zustand";
import {
  calculateSimulationData,
  LBPConfig,
  SimulationStep,
  calculateSpotPrice,
  calculateOutGivenIn,
  getDemandCurve,
  getDemandPressureCurve,
  DemandPressureConfig,
  DEFAULT_DEMAND_PRESSURE_CONFIG,
  SellPressureConfig,
  DEFAULT_SELL_PRESSURE_CONFIG,
  getLoyalSellSchedule,
} from "@/lib/lbp-math";
import type { SimulationStateSnapshot } from "@/lib/simulation-core";

export interface Swap {
  id: string; // Unique identifier for React keys
  time: string;
  account: string;
  amountIn: number; // Input amount
  amountOut: number; // Output amount
  price: number;
  timestamp: number;
  direction: "buy" | "sell"; // buy = USDC -> Token, sell = Token -> USDC
}

export interface LimitOrder {
  id: string;
  type: "buy";
  triggerPrice: number; // Price in collateral token per project token
  collateralAmount: number; // Max collateral to spend when triggered
  status: "open" | "filled" | "cancelled";
  createdAt: number;
  filledAt?: number;
}

export interface TwapOrder {
  id: string;
  type: "buy";
  totalCollateral: number;
  remainingCollateral: number;
  numParts: number;
  partsExecuted: number;
  totalDurationHours: number;
  partDurationSteps: number;
  nextExecutionStep: number;
  priceProtectionPct: number;
  referencePrice: number;
  status: "open" | "completed" | "cancelled";
  createdAt: number;
  completedAt?: number;
}

interface SimulatorState {
  config: LBPConfig;
  simulationData: SimulationStep[];
  // Lightweight price history for charts (avoids rewriting simulationData each tick)
  priceHistory: Float64Array;
  priceHistoryVersion: number;
  // Precomputed deterministic path from simulation worker
  baseSnapshots: SimulationStateSnapshot[];
  baseSnapshotsVersion: number;
  swaps: Swap[];
  limitOrders: LimitOrder[];
  twapOrders: TwapOrder[];
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  demandCurve: number[];
  demandPressureCurve: number[];
  demandPressureConfig: DemandPressureConfig;
  sellPressureConfig: SellPressureConfig;
  sellPressureSchedule: number[];
  // Derived approximate sell pressure curve in USDC per step (for charts)
  sellPressureCurve: number[];

  // Community holdings for sell-pressure modeling
  communityTokensHeld: number;
  communityAvgCost: number; // average cost basis in collateral per token

  // Simulation State
  currentTknBalance: number;
  currentUsdcBalance: number;
  intervalId: NodeJS.Timeout | null;

  // User Wallet State
  userTknBalance: number;
  userUsdcBalance: number;

  // Simulation Speed
  simulationSpeed: number; // Speed multiplier (1x, 10x, 25x, 50x)

  // UI State
  isConfigOpen: boolean;

  // Actions
  updateConfig: (partialConfig: Partial<LBPConfig>) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setSimulationSpeed: (speed: number) => void;
  setIsConfigOpen: (open: boolean) => void;
  updateDemandPressureConfig: (config: Partial<DemandPressureConfig>) => void;
  updateSellPressureConfig: (config: Partial<SellPressureConfig>) => void;
  resetConfig: () => void;
  tick: () => void;
  processBuy: (amountUSDC: number) => void;
  processSell: (amountToken: number) => void;
  updateUserBalance: (tknDelta: number, usdcDelta: number) => void;
  createLimitOrder: (order: {
    type: "buy";
    triggerPrice: number;
    collateralAmount: number;
  }) => void;
  cancelLimitOrder: (id: string) => void;
  createTwapOrder: (order: {
    type: "buy";
    totalCollateral: number;
    numParts: number;
    totalDurationHours: number;
    priceProtectionPct: number;
  }) => void;
  cancelTwapOrder: (id: string) => void;
  setBaseSnapshots: (snapshots: SimulationStateSnapshot[]) => void;
  setCurrentStep: (step: number) => void;
  // Internal functions for bot trades (don't affect user wallet)
  _processPoolBuy: (amountUSDC: number, account?: string) => void;
  _processPoolSell: (amountToken: number, account?: string) => void;
}

const DEFAULT_CONFIG: LBPConfig = {
  tokenName: "Balancer",
  tokenSymbol: "BAL",
  totalSupply: 100_000_000,
  percentForSale: 50,
  collateralToken: "USDC",

  tknBalanceIn: 50_000_000, // 50% of 100M
  tknWeightIn: 90,
  usdcBalanceIn: 1_000_000, // 1M start
  usdcWeightIn: 10,
  tknWeightOut: 10,
  usdcWeightOut: 90,
  startDelay: 0,
  duration: 72, // 72 hours (3 days)
  swapFee: 1, // 1% swap fee (default)
  creatorFee: 5, // 5% creator fee (default)
};

const TOTAL_STEPS = 300; // Granularity of simulation
const MAX_SWAPS = 500;

function computeSellPressureCurve(
  config: LBPConfig,
  schedule: number[],
  sellConfig: SellPressureConfig,
): number[] {
  const steps = schedule.length;
  if (steps === 0) return [];

  const initialPrice = calculateSpotPrice(
    config.usdcBalanceIn,
    config.usdcWeightIn,
    config.tknBalanceIn,
    config.tknWeightIn,
  );
  const totalSupplyTokens = config.tknBalanceIn;

  if (sellConfig.preset === "loyal") {
    if (sellConfig.loyalSoldPct <= 0) {
      return new Array(steps).fill(0);
    }
    const totalSellTokens =
      totalSupplyTokens * (sellConfig.loyalSoldPct / 100);
    const totalSellUSDC = totalSellTokens * initialPrice;
    return schedule.map((w) => totalSellUSDC * w);
  }

  // Greedy community: path-dependent in the real simulation (depends on price vs
  // cost basis). For the demand-curve chart we approximate a deterministic sell
  // curve so the user can see \"some\" sell pressure:
  //
  // - Assume only a modest portion of supply will be sold on profit-taking.
  // - Higher spread => fewer expected sells.
  const maxGreedyFractionOfSupply = 0.35; // 35% of initial tokens at most
  const spreadFactor = 1 / (1 + sellConfig.greedySpreadPct / 10);
  const intensity = (sellConfig.greedySellPct / 100) * spreadFactor;
  const greedySellTokens =
    totalSupplyTokens * maxGreedyFractionOfSupply * intensity;
  const greedySellUSDC = greedySellTokens * initialPrice;

  // Use the same schedule shape (edges heavier) so loyal/greedy are comparable
  // visually, just with different total mass.
  return schedule.map((w) => greedySellUSDC * w);
}

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  config: DEFAULT_CONFIG,
  simulationData: calculateSimulationData(DEFAULT_CONFIG, TOTAL_STEPS),
  priceHistory: new Float64Array(
    calculateSimulationData(DEFAULT_CONFIG, TOTAL_STEPS).map((d) => d.price),
  ),
  priceHistoryVersion: 0,
  baseSnapshots: [],
  baseSnapshotsVersion: 0,
  swaps: [],
  limitOrders: [],
  twapOrders: [],
  isPlaying: false,
  currentStep: 0, // Start before step 0
  totalSteps: TOTAL_STEPS,
  demandCurve: getDemandCurve(DEFAULT_CONFIG.duration, TOTAL_STEPS),
  demandPressureConfig: DEFAULT_DEMAND_PRESSURE_CONFIG,
  demandPressureCurve: getDemandPressureCurve(
    DEFAULT_CONFIG.duration,
    TOTAL_STEPS,
    DEFAULT_DEMAND_PRESSURE_CONFIG,
  ),
  sellPressureConfig: DEFAULT_SELL_PRESSURE_CONFIG,
  sellPressureSchedule: getLoyalSellSchedule(
    DEFAULT_CONFIG.duration,
    TOTAL_STEPS,
    DEFAULT_SELL_PRESSURE_CONFIG.loyalConcentrationPct,
  ),
  sellPressureCurve: computeSellPressureCurve(
    DEFAULT_CONFIG,
    getLoyalSellSchedule(
      DEFAULT_CONFIG.duration,
      TOTAL_STEPS,
      DEFAULT_SELL_PRESSURE_CONFIG.loyalConcentrationPct,
    ),
    DEFAULT_SELL_PRESSURE_CONFIG,
  ),

  currentTknBalance: DEFAULT_CONFIG.tknBalanceIn,
  currentUsdcBalance: DEFAULT_CONFIG.usdcBalanceIn,
  intervalId: null,

  // User wallet balances - player starts with 10k USDC and 0 tokens
  userTknBalance: 0,
  userUsdcBalance: 10000,

  // Community holdings (for sell pressure)
  communityTokensHeld: 0,
  communityAvgCost: 0,

  // Simulation speed (default 1x)
  simulationSpeed: 1,

  // UI State (sidebar open by default)
  isConfigOpen: true,

  updateConfig: (partialConfig) => {
    const currentConfig = get().config;
    // Merge new config
    let newConfig = { ...currentConfig, ...partialConfig };

    // Auto-update tknBalanceIn if supply or percentForSale changed
    if (
      partialConfig.totalSupply !== undefined ||
      partialConfig.percentForSale !== undefined
    ) {
      const supply = newConfig.totalSupply;
      const percent = newConfig.percentForSale;
      newConfig.tknBalanceIn = supply * (percent / 100);
    }

    // Recalculate static data
    const { demandPressureConfig, sellPressureConfig } = get();
    const newData = calculateSimulationData(newConfig, TOTAL_STEPS);
    const newDemand = getDemandCurve(newConfig.duration, TOTAL_STEPS);
    const newDemandPressure = getDemandPressureCurve(
      newConfig.duration,
      TOTAL_STEPS,
      demandPressureConfig,
    );
    const newSellSchedule = getLoyalSellSchedule(
      newConfig.duration,
      TOTAL_STEPS,
      sellPressureConfig.loyalConcentrationPct,
    );
    const newSellCurve = computeSellPressureCurve(
      newConfig,
      newSellSchedule,
      sellPressureConfig,
    );

    set({
      config: newConfig,
      simulationData: newData,
      priceHistory: new Float64Array(newData.map((d) => d.price)),
      priceHistoryVersion: 0,
      baseSnapshots: [],
      baseSnapshotsVersion: 0,
      demandCurve: newDemand,
      demandPressureCurve: newDemandPressure,
      sellPressureSchedule: newSellSchedule,
      sellPressureCurve: newSellCurve,
      // Reset live vars when config changes
      currentTknBalance: newConfig.tknBalanceIn,
      currentUsdcBalance: newConfig.usdcBalanceIn,
      currentStep: 0,
      swaps: [],
    });
  },

  setIsPlaying: (isPlaying) => {
    // Clear existing interval if any
    const existingId = get().intervalId;
    if (existingId) clearInterval(existingId);

    if (isPlaying) {
      const { simulationSpeed } = get();
      const intervalMs = 500 / simulationSpeed; // Faster speed = shorter interval
      const id = setInterval(() => {
        get().tick();
      }, intervalMs);
      set({ isPlaying: true, intervalId: id });
    } else {
      set({ isPlaying: false, intervalId: null });
    }
  },

  setSimulationSpeed: (speed) => {
    const { isPlaying, intervalId } = get();
    
    // If simulation is playing, restart with new speed
    if (isPlaying && intervalId) {
      clearInterval(intervalId);
      const intervalMs = 500 / speed;
      const id = setInterval(() => {
        get().tick();
      }, intervalMs);
      set({ simulationSpeed: speed, intervalId: id });
    } else {
      set({ simulationSpeed: speed });
    }
  },

  setIsConfigOpen: (open: boolean) => {
    set({ isConfigOpen: open });
  },

  updateDemandPressureConfig: (partialConfig: Partial<DemandPressureConfig>) => {
    const { demandPressureConfig, config } = get();
    const newConfig = { ...demandPressureConfig, ...partialConfig };
    const newCurve = getDemandPressureCurve(
      config.duration,
      TOTAL_STEPS,
      newConfig,
    );

    set({
      demandPressureConfig: newConfig,
      demandPressureCurve: newCurve,
    });
  },

  updateSellPressureConfig: (partialConfig: Partial<SellPressureConfig>) => {
    const { sellPressureConfig, config } = get();
    const newConfig: SellPressureConfig = {
      ...sellPressureConfig,
      ...partialConfig,
    };
    const newSchedule = getLoyalSellSchedule(
      config.duration,
      TOTAL_STEPS,
      newConfig.loyalConcentrationPct,
    );
    const newSellCurve = computeSellPressureCurve(
      config,
      newSchedule,
      newConfig,
    );

    set({
      sellPressureConfig: newConfig,
      sellPressureSchedule: newSchedule,
      sellPressureCurve: newSellCurve,
    });
  },

  resetConfig: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);

    set({
      config: DEFAULT_CONFIG,
      simulationData: calculateSimulationData(DEFAULT_CONFIG, TOTAL_STEPS),
      priceHistory: new Float64Array(
        calculateSimulationData(DEFAULT_CONFIG, TOTAL_STEPS).map((d) => d.price),
      ),
      priceHistoryVersion: 0,
      baseSnapshots: [],
      baseSnapshotsVersion: 0,
      swaps: [],
      limitOrders: [],
      twapOrders: [],
      isPlaying: false,
      currentStep: 0,
      currentTknBalance: DEFAULT_CONFIG.tknBalanceIn,
      currentUsdcBalance: DEFAULT_CONFIG.usdcBalanceIn,
      demandCurve: getDemandCurve(DEFAULT_CONFIG.duration, TOTAL_STEPS),
      demandPressureConfig: DEFAULT_DEMAND_PRESSURE_CONFIG,
      demandPressureCurve: getDemandPressureCurve(
        DEFAULT_CONFIG.duration,
        TOTAL_STEPS,
        DEFAULT_DEMAND_PRESSURE_CONFIG,
      ),
      sellPressureConfig: DEFAULT_SELL_PRESSURE_CONFIG,
      sellPressureSchedule: getLoyalSellSchedule(
        DEFAULT_CONFIG.duration,
        TOTAL_STEPS,
        DEFAULT_SELL_PRESSURE_CONFIG.loyalConcentrationPct,
      ),
      sellPressureCurve: computeSellPressureCurve(
        DEFAULT_CONFIG,
        getLoyalSellSchedule(
          DEFAULT_CONFIG.duration,
          TOTAL_STEPS,
          DEFAULT_SELL_PRESSURE_CONFIG.loyalConcentrationPct,
        ),
        DEFAULT_SELL_PRESSURE_CONFIG,
      ),
      intervalId: null,
      userTknBalance: 0,
      userUsdcBalance: 10000,
      simulationSpeed: 1,
      communityTokensHeld: 0,
      communityAvgCost: 0,
    });
  },

  setBaseSnapshots: (snapshots: SimulationStateSnapshot[]) => {
    set({
      baseSnapshots: snapshots,
      baseSnapshotsVersion: Date.now(),
    });
  },

  setCurrentStep: (step: number) => {
    const clamped = Math.max(0, Math.min(Math.floor(step), get().totalSteps - 1));
    set({ currentStep: clamped });
  },

  // Internal functions for pool-only trades (used by bots, doesn't affect user wallet)
  // These must be defined before processBuy/processSell that use them
  _processPoolBuy: (amountUSDC: number, account?: string) => {
    const {
      currentTknBalance,
      currentUsdcBalance,
      currentStep,
      swaps,
      communityTokensHeld,
      communityAvgCost,
      baseSnapshots,
    } = get();

    const snapshot = baseSnapshots[currentStep];
    if (!snapshot) return;

    const amountOut = calculateOutGivenIn(
      currentUsdcBalance,
      snapshot.usdcWeight,
      currentTknBalance,
      snapshot.tknWeight,
      amountUSDC,
    );

    const newUsdcBalance = currentUsdcBalance + amountUSDC;
    const newTknBalance = currentTknBalance - amountOut;

    const newPrice = calculateSpotPrice(
      newUsdcBalance,
      snapshot.usdcWeight,
      newTknBalance,
      snapshot.tknWeight,
    );

    // Only record swaps for non-community accounts to avoid rendering cost
    // from per-step buy-pressure and sell-pressure bots.
    let nextSwaps: Swap[] = swaps;
    if (account !== "community") {
      const userSwap: Swap = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${account || Math.random().toString(36).substring(2, 9)}`,
        time: `${snapshot.time.toFixed(1)}h`,
        account:
          account ||
          `0x${Math.floor(Math.random() * 16777215).toString(16)}...`,
        amountIn: amountUSDC,
        amountOut: amountOut,
        price: newPrice,
        timestamp: Date.now(),
        direction: "buy",
      };
      nextSwaps = [userSwap, ...swaps];
      if (nextSwaps.length > MAX_SWAPS) nextSwaps.length = MAX_SWAPS;
    }

    // Community holdings tracking (weighted-average cost basis)
    let nextCommunityTokens = communityTokensHeld;
    let nextCommunityAvgCost = communityAvgCost;
    if (account === "community" && amountOut > 0) {
      const pricePaid = amountUSDC / amountOut;
      const newTokens = communityTokensHeld + amountOut;
      nextCommunityAvgCost =
        newTokens > 0
          ? (communityAvgCost * communityTokensHeld + pricePaid * amountOut) /
            newTokens
          : communityAvgCost;
      nextCommunityTokens = newTokens;
    }

    // Update price history in-place (cheap) and bump a version to notify charts.
    const { priceHistory, priceHistoryVersion } = get();
    priceHistory[currentStep] = newPrice;

    set({
      swaps: nextSwaps,
      currentTknBalance: newTknBalance,
      currentUsdcBalance: newUsdcBalance,
      priceHistoryVersion: priceHistoryVersion + 1,
      communityTokensHeld: nextCommunityTokens,
      communityAvgCost: nextCommunityAvgCost,
    });
  },

  _processPoolSell: (amountToken: number, account?: string) => {
    const {
      currentTknBalance,
      currentUsdcBalance,
      currentStep,
      swaps,
      communityTokensHeld,
      communityAvgCost,
      baseSnapshots,
    } = get();

    const snapshot = baseSnapshots[currentStep];
    if (!snapshot) return;

    const amountOut = calculateOutGivenIn(
      currentTknBalance,
      snapshot.tknWeight,
      currentUsdcBalance,
      snapshot.usdcWeight,
      amountToken,
    );

    const newTknBalance = currentTknBalance + amountToken;
    const newUsdcBalance = currentUsdcBalance - amountOut;

    const newPrice = calculateSpotPrice(
      newUsdcBalance,
      snapshot.usdcWeight,
      newTknBalance,
      snapshot.tknWeight,
    );

    let nextSwaps: Swap[] = swaps;
    if (account !== "community") {
      const userSwap: Swap = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${account || Math.random().toString(36).substring(2, 9)}`,
        time: `${snapshot.time.toFixed(1)}h`,
        account:
          account ||
          `0x${Math.floor(Math.random() * 16777215).toString(16)}...`,
        amountIn: amountToken,
        amountOut: amountOut,
        price: newPrice,
        timestamp: Date.now(),
        direction: "sell",
      };
      nextSwaps = [userSwap, ...swaps];
      if (nextSwaps.length > MAX_SWAPS) nextSwaps.length = MAX_SWAPS;
    }


    // Community holdings tracking (reduces holdings; keep avg cost unchanged)
    let nextCommunityTokens = communityTokensHeld;
    let nextCommunityAvgCost = communityAvgCost;
    if (account === "community" && amountToken > 0) {
      nextCommunityTokens = Math.max(0, communityTokensHeld - amountToken);
      if (nextCommunityTokens === 0) nextCommunityAvgCost = 0;
    }

    const { priceHistory, priceHistoryVersion } = get();
    priceHistory[currentStep] = newPrice;

    set({
      swaps: nextSwaps,
      currentTknBalance: newTknBalance,
      currentUsdcBalance: newUsdcBalance,
      priceHistoryVersion: priceHistoryVersion + 1,
      communityTokensHeld: nextCommunityTokens,
      communityAvgCost: nextCommunityAvgCost,
    });
  },

  processSell: (amountToken: number) => {
    const {
      currentTknBalance,
      currentUsdcBalance,
      currentStep,
      baseSnapshots,
    } = get();
    const snapshot = baseSnapshots[currentStep];
    if (!snapshot) return;

    // Calculate output before processing
    const amountOut = calculateOutGivenIn(
      currentTknBalance,
      snapshot.tknWeight,
      currentUsdcBalance,
      snapshot.usdcWeight,
      amountToken,
    );

    // Process pool trade (updates pool balances and records bid)
    get()._processPoolSell(amountToken, `0x${Math.floor(Math.random() * 16777215).toString(16)}...`);

    // Update user wallet: subtract token, add USDC
    const { userTknBalance, userUsdcBalance } = get();
    set({
      userTknBalance: Math.max(0, userTknBalance - amountToken),
      userUsdcBalance: Math.max(0, userUsdcBalance + amountOut),
    });
  },

  processBuy: (amountUSDC: number) => {
    const {
      currentTknBalance,
      currentUsdcBalance,
      currentStep,
      baseSnapshots,
    } = get();
    const snapshot = baseSnapshots[currentStep];
    if (!snapshot) return;

    // Calculate output before processing
    const amountOut = calculateOutGivenIn(
      currentUsdcBalance,
      snapshot.usdcWeight,
      currentTknBalance,
      snapshot.tknWeight,
      amountUSDC,
    );

    // Process pool trade (updates pool balances and records bid)
    get()._processPoolBuy(amountUSDC, `0x${Math.floor(Math.random() * 16777215).toString(16)}...`);

    // Update user wallet: subtract USDC, add token
    const { userTknBalance, userUsdcBalance } = get();
    set({
      userTknBalance: Math.max(0, userTknBalance + amountOut),
      userUsdcBalance: Math.max(0, userUsdcBalance - amountUSDC),
    });
  },

  updateUserBalance: (tknDelta: number, usdcDelta: number) => {
    const { userTknBalance, userUsdcBalance } = get();
    set({
      userTknBalance: Math.max(0, userTknBalance + tknDelta),
      userUsdcBalance: Math.max(0, userUsdcBalance + usdcDelta),
    });
  },

  createLimitOrder: ({ type, triggerPrice, collateralAmount }) => {
    if (type !== "buy" || triggerPrice <= 0 || collateralAmount <= 0) return;

    const newOrder: LimitOrder = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      triggerPrice,
      collateralAmount,
      status: "open",
      createdAt: Date.now(),
    };

    set((state) => ({
      limitOrders: [...state.limitOrders, newOrder],
    }));
  },

  cancelLimitOrder: (id: string) => {
    set((state) => ({
      limitOrders: state.limitOrders.map((order) =>
        order.id === id && order.status === "open"
          ? { ...order, status: "cancelled" }
          : order,
      ),
    }));
  },

  createTwapOrder: ({
    type,
    totalCollateral,
    numParts,
    totalDurationHours,
    priceProtectionPct,
  }) => {
    if (
      type !== "buy" ||
      totalCollateral <= 0 ||
      numParts < 1 ||
      totalDurationHours <= 0
    ) {
      return;
    }

    const { config, currentStep, simulationData } = get();
    const stepsPerHour = TOTAL_STEPS / config.duration;
    const totalDurationSteps = Math.max(
      1,
      Math.round(totalDurationHours * stepsPerHour),
    );
    const partDurationSteps = Math.max(
      1,
      Math.round(totalDurationSteps / numParts),
    );

    const stepData = simulationData[currentStep] || simulationData[0];
    const referencePrice = stepData?.price ?? 0;

    const newOrder: TwapOrder = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      totalCollateral,
      remainingCollateral: totalCollateral,
      numParts,
      partsExecuted: 0,
      totalDurationHours,
      partDurationSteps,
      nextExecutionStep: currentStep + partDurationSteps,
      priceProtectionPct,
      referencePrice,
      status: "open",
      createdAt: Date.now(),
    };

    set((state) => ({
      twapOrders: [...state.twapOrders, newOrder],
    }));
  },

  cancelTwapOrder: (id: string) => {
    set((state) => ({
      twapOrders: state.twapOrders.map((order) =>
        order.id === id && order.status === "open"
          ? { ...order, status: "cancelled", completedAt: Date.now() }
          : order,
      ),
    }));
  },

  tick: () => {
    const {
      currentStep,
      totalSteps,
      setIsPlaying,
      limitOrders,
      twapOrders,
      baseSnapshots,
      priceHistory,
      priceHistoryVersion,
      swaps,
    } = get();

    if (!baseSnapshots || baseSnapshots.length === 0) {
      // No precomputed path yet; wait for worker to finish.
      return;
    }

    const maxStep = Math.min(totalSteps - 1, baseSnapshots.length - 1);

    if (currentStep >= maxStep) {
      setIsPlaying(false);
      return;
    }

    // 1. Advance Step (only update if changed)
    const nextStep = currentStep + 1;
    const snapshot = baseSnapshots[nextStep];

    // Advance step and sync live balances/community state to snapshot.
    if (snapshot) {
      priceHistory[nextStep] = snapshot.price;
      let nextSwaps = [...swaps];

      // Record bot buys/sells explicitly using per-step volumes from the worker.
      if (snapshot.buyVolumeUSDC > 0 && snapshot.buyVolumeTKN > 0) {
        nextSwaps.unshift({
          id: `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}-community-buy`,
          time: `${snapshot.time.toFixed(1)}h`,
          account: "community",
          amountIn: snapshot.buyVolumeUSDC,
          amountOut: snapshot.buyVolumeTKN,
          price: snapshot.price,
          timestamp: Date.now(),
          direction: "buy",
        });
      }

      if (snapshot.sellVolumeUSDC > 0 && snapshot.sellVolumeTKN > 0) {
        nextSwaps.unshift({
          id: `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}-community-sell`,
          time: `${snapshot.time.toFixed(1)}h`,
          account: "community",
          amountIn: snapshot.sellVolumeTKN,
          amountOut: snapshot.sellVolumeUSDC,
          price: snapshot.price,
          timestamp: Date.now(),
          direction: "sell",
        });
      }

      if (nextSwaps.length > MAX_SWAPS) {
        nextSwaps = nextSwaps.slice(0, MAX_SWAPS);
      }

      set({
        currentStep: nextStep,
        currentTknBalance: snapshot.tknBalance,
        currentUsdcBalance: snapshot.usdcBalance,
        communityTokensHeld: snapshot.communityTokensHeld,
        communityAvgCost: snapshot.communityAvgCost,
        priceHistoryVersion: priceHistoryVersion + 1,
        swaps: nextSwaps,
      });
    }

    const currentPrice = snapshot?.price ?? 0;

    // 4. Execute user limit orders when conditions are met
    if (limitOrders.length > 0) {
      const updatedOrders: LimitOrder[] = limitOrders.map((order) => {
        if (order.status !== "open") return order;

        // Only buy-type limit orders are currently supported
        if (order.type === "buy" && currentPrice <= order.triggerPrice) {
          const { userUsdcBalance } = get();

          if (userUsdcBalance >= order.collateralAmount) {
            // Execute a simulated buy using existing logic
            get().processBuy(order.collateralAmount);

            const filledOrder: LimitOrder = {
              ...order,
              status: "filled",
              filledAt: Date.now(),
            };
            return filledOrder;
          }
        }

        return order;
      });

      set({ limitOrders: updatedOrders });
    }

    // 5. Execute TWAP orders on schedule with price protection
    if (twapOrders.length > 0) {
      const { userUsdcBalance } = get();

      const updatedTwapOrders: TwapOrder[] = twapOrders.map((order) => {
        if (order.status !== "open") return order;

        // Check schedule
        if (nextStep < order.nextExecutionStep) {
          return order;
        }

        if (order.remainingCollateral <= 0 || order.partsExecuted >= order.numParts) {
          return {
            ...order,
            status: "completed",
            completedAt: order.completedAt ?? Date.now(),
          };
        }

        // Price protection: don't execute if price has moved above allowed threshold
        const maxAllowedPrice =
          order.referencePrice * (1 + order.priceProtectionPct / 100);
        if (currentPrice > maxAllowedPrice) {
          // Skip this tick, schedule next attempt at same cadence
          return {
            ...order,
            nextExecutionStep: nextStep + order.partDurationSteps,
          };
        }

        // Determine how much to spend this part
        const idealPerPart = order.totalCollateral / order.numParts;
        const maxThisPart = Math.min(idealPerPart, order.remainingCollateral);

        // Ensure user has enough balance for this slice
        const spendThisPart = Math.min(maxThisPart, userUsdcBalance);
        if (spendThisPart <= 0) {
          return order;
        }

        // Execute as a normal buy
        get().processBuy(spendThisPart);

        const newRemaining = order.remainingCollateral - spendThisPart;
        const newPartsExecuted = order.partsExecuted + 1;
        const isCompleted =
          newRemaining <= 0 || newPartsExecuted >= order.numParts || nextStep >= totalSteps - 1;

        return {
          ...order,
          remainingCollateral: newRemaining,
          partsExecuted: newPartsExecuted,
          nextExecutionStep: nextStep + order.partDurationSteps,
          status: isCompleted ? "completed" : "open",
          completedAt: isCompleted ? Date.now() : order.completedAt,
        };
      });

      set({ twapOrders: updatedTwapOrders });
    }
  },
}));
