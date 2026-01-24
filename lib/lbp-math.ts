export interface LBPConfig {
  // Token Metadata
  tokenName: string;
  tokenSymbol: string;
  totalSupply: number;
  percentForSale: number; // e.g. 50 for 50%

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
  timeLabel: string; // e.g., "Hour 1"
  price: number;
  tknWeight: number;
  usdcWeight: number;
  tknBalance: number;
  usdcBalance: number;
  marketCap: number;
}

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
 * Generates a demand curve (Fair Value) based on time
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
