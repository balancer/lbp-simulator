export type CollateralToken = "USDC" | "ETH" | "wETH";

export interface LBPConfig {
  tokenName: string;
  tokenSymbol: string;
  totalSupply: number;
  percentForSale: number;
  collateralToken: CollateralToken;

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

export type BuyPressurePreset = "bullish" | "bearish";

export type BuyPressureMagnitudeBase = 10_000 | 100_000 | 1_000_000;

/**
 * Buy pressure model configuration.
 *
 * The curve is interpreted as **cumulative USDC buy volume over time**.
 * We convert cumulative → per-step flow via discrete differences.
 */
export interface DemandPressureConfig {
  preset: BuyPressurePreset;
  magnitudeBase: BuyPressureMagnitudeBase; // 10k / 100k / 1M
  multiplier: number; // fine control (e.g. 0.5x, 2x)
}

export const DEFAULT_DEMAND_PRESSURE_CONFIG: DemandPressureConfig = {
  preset: "bullish",
  magnitudeBase: 100_000,
  multiplier: 1,
};

export type SellPressurePreset = "loyal" | "greedy";

export interface SellPressureConfig {
  preset: SellPressurePreset;
  // Loyal community parameters
  loyalSoldPct: number; // percentage of community-held tokens targeted for sale over campaign (0-100)
  loyalConcentrationPct: number; // percentage of sell weight concentrated at start+end (0-100)
  // Greedy community parameters
  greedySpreadPct: number; // price spread over cost basis before selling (e.g. 2 = 2%)
  greedySellPct: number; // percentage of holdings sold when threshold hit (0-100)
}

export const DEFAULT_SELL_PRESSURE_CONFIG: SellPressureConfig = {
  preset: "loyal",
  loyalSoldPct: 5,
  loyalConcentrationPct: 60,
  greedySpreadPct: 2,
  greedySellPct: 100,
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
 * Generates a demand curve (Fair Value price) based on LBP weight changes
 * This represents the "fair value" price that market participants expect
 * Price changes hyperbolically based on weight ratio (price ∝ 1/weight)
 */
export function getDemandCurve(
  hours: number,
  steps: number,
  initialWeight?: number,
  finalWeight?: number,
  initialPrice?: number,
): number[] {
  const curve = [];

  const initialWeightDecimal =
    initialWeight !== undefined
      ? initialWeight > 1
        ? initialWeight / 100
        : initialWeight
      : 0.95; // Default 95%
  const finalWeightDecimal =
    finalWeight !== undefined
      ? finalWeight > 1
        ? finalWeight / 100
        : finalWeight
      : 0.5; // Default 50%
  const basePrice = initialPrice ?? 0.5;

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;

    // Weight changes linearly over time
    const currentWeight =
      initialWeightDecimal -
      (initialWeightDecimal - finalWeightDecimal) * progress;

    // Price changes hyperbolically based on weight ratio
    // When collateral is constant: price ∝ 1/weight
    const weightRatio = initialWeightDecimal / currentWeight;
    const price = basePrice / weightRatio;

    curve.push(price);
  }

  return curve;
}

function clampNumber(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Preset cumulative buy pressure curves (normalized 0→1, monotone increasing).
 *
 * - bullish: near-linear / gently concave → "constant high" buying.
 * - bearish: convex → lighter early, ramps later; also lower total by default.
 */
export function getCumulativeBuyPressureCurve(
  hours: number,
  steps: number,
  config: DemandPressureConfig,
): number[] {
  const curve: number[] = [];
  const safeSteps = Math.max(1, steps);

  const multiplier = clampNumber(config.multiplier ?? 1, 0, 1_000_000);
  const base = config.magnitudeBase;

  // Make bearish overall "lighter" than bullish at the same base, per product spec.
  const endScale = config.preset === "bearish" ? 0.35 : 1.0;
  const endTotalUsdc = base * multiplier * endScale;

  for (let i = 0; i <= safeSteps; i++) {
    const progress = i / safeSteps; // 0..1

    let normalized: number;
    if (config.preset === "bearish") {
      // Convex: slow early, faster later
      normalized = Math.pow(progress, 1.8);
    } else {
      // Gently concave: steadier throughout (slightly front-loaded)
      normalized = Math.pow(progress, 0.9);
    }

    curve.push(endTotalUsdc * clampNumber(normalized, 0, 1));
  }

  // Ensure monotone + exact endpoints
  curve[0] = 0;
  curve[curve.length - 1] = endTotalUsdc;
  for (let i = 1; i < curve.length; i++) {
    curve[i] = Math.max(curve[i], curve[i - 1]);
  }

  return curve;
}

export function getPerStepBuyFlowFromCumulative(
  cumulative: number[],
): number[] {
  if (cumulative.length === 0) return [];
  const flow: number[] = [];
  flow.push(0);
  for (let i = 1; i < cumulative.length; i++) {
    const d = cumulative[i] - cumulative[i - 1];
    flow.push(Math.max(0, d));
  }
  return flow;
}

/**
 * Back-compat: some callers expect a "pressure curve" array.
 * Now returns **per-step USDC buy flow** derived from the configured cumulative curve.
 */
export function getDemandPressureCurve(
  hours: number,
  steps: number,
  config: DemandPressureConfig,
): number[] {
  const cumulative = getCumulativeBuyPressureCurve(hours, steps, config);
  return getPerStepBuyFlowFromCumulative(cumulative);
}

/**
 * Loyal community sell schedule.
 *
 * Returns per-step weights that sum to 1, emphasizing the
 * beginning and end of the sale via a Gaussian bump curve
 * controlled by `concentrationPct` (0–100).
 */
export function getLoyalSellSchedule(
  _hours: number,
  steps: number,
  concentrationPct: number,
): number[] {
  const safeSteps = Math.max(1, steps);

  const clampedConc = clampNumber(concentrationPct, 0, 100);
  const a = clampedConc / 100; // 0..1

  const sigmaMax = 0.25; // smooth spread
  const sigmaMin = Math.max(1 / safeSteps, 0.03); // avoid too needle-like / unstable
  const sigma = sigmaMax + (sigmaMin - sigmaMax) * a;

  const gauss = (t: number) => Math.exp(-0.5 * (t / sigma) ** 2);

  const bumpAtEdge = gauss(0) + gauss(1); // ~ 1 + almost 0
  const bumpScale = bumpAtEdge > 0 ? 1 / bumpAtEdge : 1;

  const weights = new Array<number>(safeSteps + 1);
  for (let i = 0; i <= safeSteps; i++) {
    const x = i / safeSteps; // 0..1
    const bump = (gauss(x) + gauss(1 - x)) * bumpScale;
    weights[i] = 1 + a * bump;
  }

  const total = weights.reduce((acc, w) => acc + w, 0);
  if (total === 0) return new Array(safeSteps + 1).fill(0);
  return weights.map((w) => w / total);
}

/**
 * Calculates expected trading volume based on demand pressure and price discount
 * Combines demand pressure intensity with price-based probability
 */
// NOTE: calculateTradingVolume removed in the new model.

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
  const baseFlowCurve = getDemandPressureCurve(config.duration, steps, demandPressureConfig);
  // Calculate base simulation data (no trades)
  const baseData = calculateSimulationData(config, steps);

  // For each scenario, simulate price evolution
  for (const demandMultiplier of scenarios) {
    const path: number[] = [];
    let tknBalance = config.tknBalanceIn;
    let usdcBalance = config.usdcBalanceIn;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;

      // Interpolate weights
      const currentTknWeight =
        config.tknWeightIn +
        (config.tknWeightOut - config.tknWeightIn) * progress;
      const currentUsdcWeight =
        config.usdcWeightIn +
        (config.usdcWeightOut - config.usdcWeightIn) * progress;

      // Calculate current price
      calculateSpotPrice(
        usdcBalance,
        currentUsdcWeight,
        tknBalance,
        currentTknWeight,
      );

      // Get demand pressure for this step
      const flowUSDC = (baseFlowCurve[i] || 0) * demandMultiplier;

      // Apply buys to simulate price impact
      if (flowUSDC > 0) {
        // Calculate how much token would be bought
        const amountOut = calculateOutGivenIn(
          usdcBalance,
          currentUsdcWeight,
          tknBalance,
          currentTknWeight,
          flowUSDC,
        );

        // Update balances (simulating the buy)
        usdcBalance += flowUSDC;
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
