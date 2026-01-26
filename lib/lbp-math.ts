export interface LBPConfig {
  tokenName: string;
  tokenSymbol: string;
  totalSupply: number;
  percentForSale: number;

  // LBP Params
  tknBalanceIn: number; // Token balance (derived, but kept for calculation)
  tknWeightIn: number; // Initial Token weight (e.g. 90)
  usdcBalanceIn: number; // Initial USDC balance (e.g. 500k USDC)
  usdcWeightIn: number; // Initial USDC weight (e.g. 10)
  tknWeightOut: number; // Final Token weight (e.g. 10)
  usdcWeightOut: number; // Final USDC weight (e.g. 90)
  startDelay: number; // Delay before start (in blocks/time)
  duration: number; // Duration of LBP (in hours)
  swapFee?: number; // Swap fee (e.g., 0.01 for 1%)
  creatorFee: number; // Creator fee percentage (1-10%)
}

export interface SimulationStep {
  time: number;
  timeLabel: string;
  price: number;
  tknWeight: number;
  usdcWeight: number;
  tknBalance: number;
  usdcBalance: number;
  marketCap: number;
}

export interface DemandPressureConfig {
  baseIntensity: number; // Maximum trading intensity at the end (0-1)
  floorIntensity: number; // Minimum trading intensity at the start (0-1)
  growthRate: number; // How fast intensity grows over time (0.5-3) - affects square root curve steepness
  priceDiscountMultiplier: number; // How much price discount amplifies volume (0.5-3)
  baseTradeSize: number; // Base trade size in USDC
  tradeSizeVariation: number; // Variation multiplier for trade sizes (1-5x)
}

export const DEFAULT_DEMAND_PRESSURE_CONFIG: DemandPressureConfig = {
  baseIntensity: 1.0, // High activity at the end when price finds fair value
  floorIntensity: 0.1, // Low activity at the start (high price prevents front-running)
  growthRate: 1.0, // Square root growth rate (1.0 = standard √x curve)
  priceDiscountMultiplier: 2.0,
  baseTradeSize: 10_000,
  tradeSizeVariation: 2.0,
};

/**
 * Calculates Spot Price based on Balancer formula
 * Price = (BalanceUSDC / WeightUSDC) / (BalanceTKN / WeightTKN)
 */
export function calculateSpotPrice(
  usdcBalance: number,
  usdcWeight: number,
  tknBalance: number,
  tknWeight: number,
): number {
  if (tknBalance === 0 || tknWeight === 0) return 0;
  const numer = usdcBalance / usdcWeight;
  const denom = tknBalance / tknWeight;
  return numer / denom;
}

/**
 * Calculate the Amount of Token Received for a given Amount of Collateral Spent
 * Formula: Ao = Bo * (1 - (Bi / (Bi + Ai)) ^ (wi / wo))
 */
export function calculateOutGivenIn(
  balanceIn: number,
  weightIn: number,
  balanceOut: number,
  weightOut: number,
  amountIn: number,
): number {
  const weightRatio = weightIn / weightOut;
  const adjustedIn = amountIn;
  const base = balanceIn / (balanceIn + adjustedIn);
  const power = Math.pow(base, weightRatio);
  return balanceOut * (1 - power);
}

/**
 * Generates a demand curve (Fair Value price) based on time
 * This represents the "fair value" price that market participants expect
 */
export function getDemandCurve(hours: number, steps: number): number[] {
  const curve = [];
  const basePrice = 0.5; // Start
  const endPrice = 0.1; // End

  // Simulate "Market Consensus" dropping over time as hype fades or finding true value
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Exponential decay of "Fair Value" expectation till it hits floor
    const fairValue = basePrice * Math.exp(-2 * progress) + endPrice;
    curve.push(fairValue);
  }
  return curve;
}

/**
 * Generates a demand pressure curve (trading volume/intensity) based on time
 * Returns trading volume/intensity (0-1 scale) over time
 * Low at start (high price prevents front-running), increases over time as price drops
 * Uses square root growth: intensity = floor + (base - floor) * sqrt(progress^growthRate)
 */
export function getDemandPressureCurve(
  hours: number,
  steps: number,
  config: DemandPressureConfig,
): number[] {
  const curve = [];

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps; // 0 to 1
    // Square root growth: low at start, increases over time
    // Apply growthRate as exponent to control curve steepness
    // sqrt(progress^growthRate) = progress^(growthRate/2)
    const growthFactor = Math.pow(progress, config.growthRate / 2);
    const intensity =
      config.floorIntensity +
      (config.baseIntensity - config.floorIntensity) * growthFactor;
    curve.push(Math.max(0, Math.min(1, intensity))); // Clamp 0-1
  }
  return curve;
}

/**
 * Calculates expected trading volume based on demand pressure and price discount
 * Combines demand pressure intensity with price-based probability
 */
export function calculateTradingVolume(
  demandPressure: number,
  priceDiscount: number,
  config: DemandPressureConfig,
): number {
  // Base volume scales with demand pressure
  // Price discount amplifies volume (more buying when price is below fair value)
  const discountMultiplier = Math.max(
    0.5,
    1 + priceDiscount * config.priceDiscountMultiplier,
  );
  return demandPressure * discountMultiplier;
}

export function calculateSimulationData(
  config: LBPConfig,
  steps = 100,
): SimulationStep[] {
  const data: SimulationStep[] = [];
  const {
    tknBalanceIn,
    tknWeightIn,
    usdcBalanceIn,
    usdcWeightIn,
    tknWeightOut,
    usdcWeightOut,
    duration,
  } = config;

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps; // 0 to 1
    const time = progress * duration;

    // Interpolate weights
    const currentTknWeight =
      tknWeightIn + (tknWeightOut - tknWeightIn) * progress;
    const currentUsdcWeight =
      usdcWeightIn + (usdcWeightOut - usdcWeightIn) * progress;

    const currentTknBalance = tknBalanceIn;
    const currentUsdcBalance = usdcBalanceIn;

    const price = calculateSpotPrice(
      currentUsdcBalance,
      currentUsdcWeight,
      currentTknBalance,
      currentTknWeight,
    );

    data.push({
      time,
      timeLabel: `${time.toFixed(1)}h`,
      price,
      tknWeight: currentTknWeight,
      usdcWeight: currentUsdcWeight,
      tknBalance: currentTknBalance,
      usdcBalance: currentUsdcBalance,
      marketCap: price * currentTknBalance,
    });
  }

  return data;
}

/**
 * Calculates potential price paths based on different demand scenarios
 * Simulates how the price would evolve with different demand multipliers
 * Returns an array of price paths, each representing a different demand scenario
 */
export function calculatePotentialPricePaths(
  config: LBPConfig,
  demandPressureConfig: DemandPressureConfig,
  steps: number,
  scenarios: number[] = [0.5, 1.0, 1.5], // Low, medium, high demand multipliers
): number[][] {
  const paths: number[][] = [];
  const demandPressureCurve = getDemandPressureCurve(
    config.duration,
    steps,
    demandPressureConfig,
  );
  const demandCurve = getDemandCurve(config.duration, steps);

  // Calculate base simulation data (no trades)
  const baseData = calculateSimulationData(config, steps);

  // For each scenario, simulate price evolution
  for (const demandMultiplier of scenarios) {
    const path: number[] = [];
    let tknBalance = config.tknBalanceIn;
    let usdcBalance = config.usdcBalanceIn;

    for (let i = 0; i <= steps; i++) {
      const stepData = baseData[i];
      const progress = i / steps;

      // Interpolate weights
      const currentTknWeight =
        config.tknWeightIn +
        (config.tknWeightOut - config.tknWeightIn) * progress;
      const currentUsdcWeight =
        config.usdcWeightIn +
        (config.usdcWeightOut - config.usdcWeightIn) * progress;

      // Calculate current price
      const currentPrice = calculateSpotPrice(
        usdcBalance,
        currentUsdcWeight,
        tknBalance,
        currentTknWeight,
      );

      // Get demand pressure for this step
      const baseDemandPressure = demandPressureCurve[i];
      const fairPrice = demandCurve[i];

      // Apply demand multiplier to simulate different scenarios
      const adjustedDemandPressure = Math.min(
        1,
        baseDemandPressure * demandMultiplier,
      );

      // Calculate price discount
      const priceDiscount =
        currentPrice < fairPrice ? (fairPrice - currentPrice) / fairPrice : 0;

      // Calculate trading volume
      const baseVolume = calculateTradingVolume(
        adjustedDemandPressure,
        priceDiscount,
        demandPressureConfig,
      );

      // Simulate expected buy volume for this step
      // Higher demand = more buying = price goes up
      const expectedBuyVolume =
        baseVolume * demandPressureConfig.baseTradeSize * adjustedDemandPressure;

      // Apply buys to simulate price impact
      if (expectedBuyVolume > 0 && currentPrice < fairPrice) {
        // Calculate how much token would be bought
        const amountOut = calculateOutGivenIn(
          usdcBalance,
          currentUsdcWeight,
          tknBalance,
          currentTknWeight,
          expectedBuyVolume,
        );

        // Update balances (simulating the buy)
        usdcBalance += expectedBuyVolume;
        tknBalance -= amountOut;
      }

      // Calculate new price after simulated trades
      const newPrice = calculateSpotPrice(
        usdcBalance,
        currentUsdcWeight,
        tknBalance,
        currentTknWeight,
      );

      path.push(newPrice);
    }

    paths.push(path);
  }

  return paths;
}
