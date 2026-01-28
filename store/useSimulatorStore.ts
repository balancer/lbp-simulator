import { create } from "zustand";
import { shallow } from "zustand/shallow";
import {
  calculateSimulationData,
  LBPConfig,
  SimulationStep,
  calculateSpotPrice,
  calculateOutGivenIn,
  getDemandCurve,
  getDemandPressureCurve,
  calculateTradingVolume,
  DemandPressureConfig,
  DEFAULT_DEMAND_PRESSURE_CONFIG,
} from "@/lib/lbp-math";

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
  swaps: Swap[];
  limitOrders: LimitOrder[];
  twapOrders: TwapOrder[];
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  demandCurve: number[];
  demandPressureCurve: number[];
  demandPressureConfig: DemandPressureConfig;

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
  // Internal functions for bot trades (don't affect user wallet)
  _processPoolBuy: (amountUSDC: number, account?: string) => void;
  _processPoolSell: (amountToken: number, account?: string) => void;
}

const DEFAULT_CONFIG: LBPConfig = {
  tokenName: "ACME Protocol",
  tokenSymbol: "ACME",
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

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  config: DEFAULT_CONFIG,
  simulationData: calculateSimulationData(DEFAULT_CONFIG, TOTAL_STEPS),
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

  currentTknBalance: DEFAULT_CONFIG.tknBalanceIn,
  currentUsdcBalance: DEFAULT_CONFIG.usdcBalanceIn,
  intervalId: null,

  // User wallet balances - player starts with 10k USDC and 0 tokens
  userTknBalance: 0,
  userUsdcBalance: 10000,

  // Simulation speed (default 1x)
  simulationSpeed: 1,

  // UI State
  isConfigOpen: false,

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
    const { demandPressureConfig } = get();
    const newData = calculateSimulationData(newConfig, TOTAL_STEPS);
    const newDemand = getDemandCurve(newConfig.duration, TOTAL_STEPS);
    const newDemandPressure = getDemandPressureCurve(
      newConfig.duration,
      TOTAL_STEPS,
      demandPressureConfig,
    );

    set({
      config: newConfig,
      simulationData: newData,
      demandCurve: newDemand,
      demandPressureCurve: newDemandPressure,
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

  resetConfig: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);

    set({
      config: DEFAULT_CONFIG,
      simulationData: calculateSimulationData(DEFAULT_CONFIG, TOTAL_STEPS),
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
      intervalId: null,
      userTknBalance: 0,
      userUsdcBalance: 10000,
      simulationSpeed: 1,
    });
  },

  // Internal functions for pool-only trades (used by bots, doesn't affect user wallet)
  // These must be defined before processBuy/processSell that use them
  _processPoolBuy: (amountUSDC: number, account?: string) => {
    const {
      currentTknBalance,
      currentUsdcBalance,
      currentStep,
      simulationData,
      swaps,
    } = get();

    const stepData = simulationData[currentStep];
    if (!stepData) return;

    const amountOut = calculateOutGivenIn(
      currentUsdcBalance,
      stepData.usdcWeight,
      currentTknBalance,
      stepData.tknWeight,
      amountUSDC,
    );

    const newUsdcBalance = currentUsdcBalance + amountUSDC;
    const newTknBalance = currentTknBalance - amountOut;

    const newPrice = calculateSpotPrice(
      newUsdcBalance,
      stepData.usdcWeight,
      newTknBalance,
      stepData.tknWeight,
    );

    const newSwap: Swap = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${account || Math.random().toString(36).substring(2, 9)}`,
      time: `${stepData.time.toFixed(1)}h`,
      account: account || `0x${Math.floor(Math.random() * 16777215).toString(16)}...`,
      amountIn: amountUSDC,
      amountOut: amountOut,
      price: newPrice,
      timestamp: Date.now(),
      direction: "buy",
    };

    const updatedData = [...simulationData];
    updatedData[currentStep] = {
      ...stepData,
      price: newPrice,
      tknBalance: newTknBalance,
      usdcBalance: newUsdcBalance,
    };

    for (let i = currentStep + 1; i < TOTAL_STEPS; i++) {
      const futureStep = updatedData[i];
      const futurePrice = calculateSpotPrice(
        newUsdcBalance,
        futureStep.usdcWeight,
        newTknBalance,
        futureStep.tknWeight,
      );
      updatedData[i] = {
        ...futureStep,
        price: futurePrice,
        tknBalance: newTknBalance,
        usdcBalance: newUsdcBalance,
      };
    }

    // Only update if values actually changed (shallow comparison optimization)
    const currentState = get();
    if (
      currentState.currentTknBalance !== newTknBalance ||
      currentState.currentUsdcBalance !== newUsdcBalance ||
      currentState.swaps.length !== swaps.length + 1
    ) {
      set({
        swaps: [newSwap, ...swaps],
        currentTknBalance: newTknBalance,
        currentUsdcBalance: newUsdcBalance,
        simulationData: updatedData,
      });
    } else {
      // Still need to update simulationData even if balances didn't change
      set({ simulationData: updatedData });
    }
  },

  _processPoolSell: (amountToken: number, account?: string) => {
    const {
      currentTknBalance,
      currentUsdcBalance,
      currentStep,
      simulationData,
      swaps,
    } = get();

    const stepData = simulationData[currentStep];
    if (!stepData) return;

    const amountOut = calculateOutGivenIn(
      currentTknBalance,
      stepData.tknWeight,
      currentUsdcBalance,
      stepData.usdcWeight,
      amountToken,
    );

    const newTknBalance = currentTknBalance + amountToken;
    const newUsdcBalance = currentUsdcBalance - amountOut;

    const newPrice = calculateSpotPrice(
      newUsdcBalance,
      stepData.usdcWeight,
      newTknBalance,
      stepData.tknWeight,
    );

    const newSwap: Swap = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${account || Math.random().toString(36).substring(2, 9)}`,
      time: `${stepData.time.toFixed(1)}h`,
      account: account || `0x${Math.floor(Math.random() * 16777215).toString(16)}...`,
      amountIn: amountToken,
      amountOut: amountOut,
      price: newPrice,
      timestamp: Date.now(),
      direction: "sell",
    };

    const updatedData = [...simulationData];
    updatedData[currentStep] = {
      ...stepData,
      price: newPrice,
      tknBalance: newTknBalance,
      usdcBalance: newUsdcBalance,
    };

    for (let i = currentStep + 1; i < TOTAL_STEPS; i++) {
      const futureStep = updatedData[i];
      const futurePrice = calculateSpotPrice(
        newUsdcBalance,
        futureStep.usdcWeight,
        newTknBalance,
        futureStep.tknWeight,
      );
      updatedData[i] = {
        ...futureStep,
        price: futurePrice,
        tknBalance: newTknBalance,
        usdcBalance: newUsdcBalance,
      };
    }

    set({
      swaps: [newSwap, ...swaps],
      currentTknBalance: newTknBalance,
      currentUsdcBalance: newUsdcBalance,
      simulationData: updatedData,
    });
  },

  processSell: (amountToken: number) => {
    const { currentTknBalance, currentUsdcBalance, currentStep, simulationData } = get();
    const stepData = simulationData[currentStep];
    if (!stepData) return;

    // Calculate output before processing
    const amountOut = calculateOutGivenIn(
      currentTknBalance,
      stepData.tknWeight,
      currentUsdcBalance,
      stepData.usdcWeight,
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
    const { currentTknBalance, currentUsdcBalance, currentStep, simulationData } = get();
    const stepData = simulationData[currentStep];
    if (!stepData) return;

    // Calculate output before processing
    const amountOut = calculateOutGivenIn(
      currentUsdcBalance,
      stepData.usdcWeight,
      currentTknBalance,
      stepData.tknWeight,
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
      simulationData,
      demandCurve,
      demandPressureCurve,
      demandPressureConfig,
      setIsPlaying,
      limitOrders,
      twapOrders,
    } = get();

    if (currentStep >= totalSteps - 1) {
      setIsPlaying(false);
      return;
    }

    // 1. Advance Step (only update if changed)
    const nextStep = currentStep + 1;
    if (nextStep !== currentStep) {
      set({ currentStep: nextStep });
    }

    // 2. DEMAND PRESSURE DRIVEN BOT LOGIC
    const currentData = simulationData[nextStep];
    const fairPrice = demandCurve[nextStep];
    const currentPrice = currentData.price;
    const demandPressure = demandPressureCurve[nextStep];

    // Calculate price discount (how much below fair value)
    const priceDiscount = currentPrice < fairPrice 
      ? (fairPrice - currentPrice) / fairPrice 
      : 0;

    // Calculate expected trading volume based on demand pressure
    const baseVolume = calculateTradingVolume(
      demandPressure,
      priceDiscount,
      demandPressureConfig,
    );

    // Determine number of swaps based on volume (Poisson-like distribution)
    // Higher volume = more likely to have swaps, and potentially multiple swaps
    const swapProbability = Math.min(1, baseVolume * 0.3); // Scale probability
    const numSwaps = Math.random() < swapProbability 
      ? Math.floor(baseVolume * 2) + 1 // At least 1 swap if probability hits
      : 0;

    // Generate swaps based on demand pressure
    for (let i = 0; i < numSwaps; i++) {
      // Trade size varies based on demand pressure and config
      const sizeMultiplier = 1 + Math.random() * demandPressureConfig.tradeSizeVariation;
      const tradeSize = demandPressureConfig.baseTradeSize * sizeMultiplier * demandPressure;
      
      // Only buy when price is below fair value (arbitrage opportunity)
      if (currentPrice < fairPrice) {
        get()._processPoolBuy(tradeSize);
      } else if (Math.random() < 0.05) {
        // Small chance of noise trades even when price is above fair value
        get()._processPoolBuy(tradeSize * 0.1);
      }
    }

    // 3. Execute user limit orders when conditions are met
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

    // 4. Execute TWAP orders on schedule with price protection
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
        const remainingParts = order.numParts - order.partsExecuted;
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
