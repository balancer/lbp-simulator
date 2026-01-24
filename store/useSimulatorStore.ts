import { create } from "zustand";
import {
  calculateSimulationData,
  LBPConfig,
  SimulationStep,
  calculateSpotPrice,
  calculateOutGivenIn,
  getDemandCurve,
} from "@/lib/lbp-math";

export interface Bid {
  time: string;
  account: string;
  amountIn: number; // Input amount
  amountOut: number; // Output amount
  price: number;
  timestamp: number;
  direction: "buy" | "sell"; // buy = USDC -> Token, sell = Token -> USDC
}

interface SimulatorState {
  config: LBPConfig;
  simulationData: SimulationStep[];
  bids: Bid[];
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  demandCurve: number[];

  // Simulation State
  currentTknBalance: number;
  currentUsdcBalance: number;
  intervalId: NodeJS.Timeout | null;

  // User Wallet State
  userTknBalance: number;
  userUsdcBalance: number;

  // Actions
  updateConfig: (partialConfig: Partial<LBPConfig>) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  resetConfig: () => void;
  tick: () => void;
  processBuy: (amountUSDC: number) => void;
  processSell: (amountToken: number) => void;
  updateUserBalance: (tknDelta: number, usdcDelta: number) => void;
  // Internal functions for bot trades (don't affect user wallet)
  _processPoolBuy: (amountUSDC: number, account?: string) => void;
  _processPoolSell: (amountToken: number, account?: string) => void;
}

const DEFAULT_CONFIG: LBPConfig = {
  tokenName: "ACME Protocol",
  tokenSymbol: "ACME",
  totalSupply: 100_000_000,
  percentForSale: 50,

  tknBalanceIn: 50_000_000, // 50% of 100M
  tknWeightIn: 90,
  usdcBalanceIn: 1_000_000, // 1M start
  usdcWeightIn: 10,
  tknWeightOut: 10,
  usdcWeightOut: 90,
  startDelay: 0,
  duration: 72, // 72 hours (3 days)
  creatorFee: 5, // 5% creator fee (default)
};

const TOTAL_STEPS = 300; // Granularity of simulation

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  config: DEFAULT_CONFIG,
  simulationData: calculateSimulationData(DEFAULT_CONFIG, TOTAL_STEPS),
  bids: [],
  isPlaying: false,
  currentStep: 0, // Start before step 0
  totalSteps: TOTAL_STEPS,
  demandCurve: getDemandCurve(DEFAULT_CONFIG.duration, TOTAL_STEPS),

  currentTknBalance: DEFAULT_CONFIG.tknBalanceIn,
  currentUsdcBalance: DEFAULT_CONFIG.usdcBalanceIn,
  intervalId: null,

  // User wallet balances - player starts with 10k USDC and 0 tokens
  userTknBalance: 0,
  userUsdcBalance: 10000,

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
    const newData = calculateSimulationData(newConfig, TOTAL_STEPS);
    const newDemand = getDemandCurve(newConfig.duration, TOTAL_STEPS);

    set({
      config: newConfig,
      simulationData: newData,
      demandCurve: newDemand,
      // Reset live vars when config changes
      currentTknBalance: newConfig.tknBalanceIn,
      currentUsdcBalance: newConfig.usdcBalanceIn,
      currentStep: 0,
      bids: [],
    });
  },

  setIsPlaying: (isPlaying) => {
    // Clear existing interval if any
    const existingId = get().intervalId;
    if (existingId) clearInterval(existingId);

    if (isPlaying) {
      const id = setInterval(() => {
        get().tick();
      }, 500); // 500ms per tick
      set({ isPlaying: true, intervalId: id });
    } else {
      set({ isPlaying: false, intervalId: null });
    }
  },

  resetConfig: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);

    set({
      config: DEFAULT_CONFIG,
      simulationData: calculateSimulationData(DEFAULT_CONFIG, TOTAL_STEPS),
      bids: [],
      isPlaying: false,
      currentStep: 0,
      currentTknBalance: DEFAULT_CONFIG.tknBalanceIn,
      currentUsdcBalance: DEFAULT_CONFIG.usdcBalanceIn,
      demandCurve: getDemandCurve(DEFAULT_CONFIG.duration, TOTAL_STEPS),
      intervalId: null,
      userTknBalance: 0,
      userUsdcBalance: 10000,
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
      bids,
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

    const newBid: Bid = {
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

    set({
      bids: [newBid, ...bids],
      currentTknBalance: newTknBalance,
      currentUsdcBalance: newUsdcBalance,
      simulationData: updatedData,
    });
  },

  _processPoolSell: (amountToken: number, account?: string) => {
    const {
      currentTknBalance,
      currentUsdcBalance,
      currentStep,
      simulationData,
      bids,
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

    const newBid: Bid = {
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
      bids: [newBid, ...bids],
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

  tick: () => {
    const {
      currentStep,
      totalSteps,
      simulationData,
      demandCurve,
      processBuy,
      setIsPlaying,
    } = get();

    if (currentStep >= totalSteps - 1) {
      setIsPlaying(false);
      return;
    }

    // 1. Advance Step
    const nextStep = currentStep + 1;
    set({ currentStep: nextStep });

    // 2. BOT LOGIC
    const currentData = simulationData[nextStep];
    const fairPrice = demandCurve[nextStep];
    const currentPrice = currentData.price;

    // Simple Bot: If Price < Fair Price, Buy!
    // Use internal pool function (doesn't affect user wallet)
    if (currentPrice < fairPrice) {
      const diff = (fairPrice - currentPrice) / fairPrice; // % discount
      if (Math.random() < diff * 2) {
        // Random Buy Size between 10k and 100k USDC
        const buySize = 10_000 + Math.random() * 90_000;
        get()._processPoolBuy(buySize);
      }
    } else {
      // Noise trades
      if (Math.random() < 0.1) {
        get()._processPoolBuy(1000 + Math.random() * 5000);
      }
    }
  },
}));
