// Web Worker for calculating potential price paths
// This runs off the main thread to keep UI responsive

// Math functions - self-contained in the worker
function calculateSpotPrice(
  usdcBalance,
  usdcWeight,
  tknBalance,
  tknWeight,
) {
  if (tknBalance === 0 || tknWeight === 0) return 0;
  const numer = usdcBalance / usdcWeight;
  const denom = tknBalance / tknWeight;
  return numer / denom;
}

function calculateOutGivenIn(
  balanceIn,
  weightIn,
  balanceOut,
  weightOut,
  amountIn,
) {
  const weightRatio = weightIn / weightOut;
  const base = balanceIn / (balanceIn + amountIn);
  const power = Math.pow(base, weightRatio);
  return balanceOut * (1 - power);
}

function clampNumber(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getCumulativeBuyPressureCurve(hours, steps, config) {
  const curve = [];
  const safeSteps = Math.max(1, steps);

  const multiplier = clampNumber(config.multiplier ?? 1, 0, 1000000);
  const base = config.magnitudeBase;
  const endScale = config.preset === "bearish" ? 0.35 : 1.0;
  const endTotalUsdc = base * multiplier * endScale;

  for (let i = 0; i <= safeSteps; i++) {
    const progress = i / safeSteps;
    let normalized;
    if (config.preset === "bearish") {
      normalized = Math.pow(progress, 1.8);
    } else {
      normalized = Math.pow(progress, 0.9);
    }
    curve.push(endTotalUsdc * clampNumber(normalized, 0, 1));
  }

  curve[0] = 0;
  curve[curve.length - 1] = endTotalUsdc;
  for (let i = 1; i < curve.length; i++) {
    curve[i] = Math.max(curve[i], curve[i - 1]);
  }

  return curve;
}

function getPerStepBuyFlowFromCumulative(cumulative) {
  if (!cumulative || cumulative.length === 0) return [];
  const flow = [0];
  for (let i = 1; i < cumulative.length; i++) {
    const d = cumulative[i] - cumulative[i - 1];
    flow.push(Math.max(0, d));
  }
  return flow;
}

function getDemandPressureCurve(hours, steps, config) {
  const cumulative = getCumulativeBuyPressureCurve(hours, steps, config);
  return getPerStepBuyFlowFromCumulative(cumulative);
}

function getDemandCurve(hours, steps) {
  const curve = [];
  const basePrice = 0.5;
  const endPrice = 0.1;
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const fairValue = basePrice * Math.exp(-2 * progress) + endPrice;
    curve.push(fairValue);
  }
  return curve;
}

// calculateTradingVolume removed in the new model.

function calculateSimulationData(config, steps) {
  const data = [];
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
    const progress = i / steps;
    const time = progress * duration;

    const currentTknWeight =
      tknWeightIn + (tknWeightOut - tknWeightIn) * progress;
    const currentUsdcWeight =
      usdcWeightIn + (usdcWeightOut - usdcWeightIn) * progress;

    const price = calculateSpotPrice(
      usdcBalanceIn,
      currentUsdcWeight,
      tknBalanceIn,
      currentTknWeight,
    );

    data.push({
      time,
      timeLabel: `${time.toFixed(1)}h`,
      price,
      tknWeight: currentTknWeight,
      usdcWeight: currentUsdcWeight,
      tknBalance: tknBalanceIn,
      usdcBalance: usdcBalanceIn,
      marketCap: price * tknBalanceIn,
    });
  }

  return data;
}

// Main calculation function
function calculatePotentialPricePaths(
  config,
  demandPressureConfig,
  steps,
  scenarios,
) {
  const paths = [];
  const demandPressureCurve = getDemandPressureCurve(
    config.duration,
    steps,
    demandPressureConfig,
  );
  const baseData = calculateSimulationData(config, steps);

  for (const demandMultiplier of scenarios) {
    const path = [];
    let tknBalance = config.tknBalanceIn;
    let usdcBalance = config.usdcBalanceIn;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;

      const currentTknWeight =
        config.tknWeightIn +
        (config.tknWeightOut - config.tknWeightIn) * progress;
      const currentUsdcWeight =
        config.usdcWeightIn +
        (config.usdcWeightOut - config.usdcWeightIn) * progress;

      calculateSpotPrice(
        usdcBalance,
        currentUsdcWeight,
        tknBalance,
        currentTknWeight,
      );

      const flowUSDC = (demandPressureCurve[i] || 0) * demandMultiplier;

      if (flowUSDC > 0) {
        const amountOut = calculateOutGivenIn(
          usdcBalance,
          currentUsdcWeight,
          tknBalance,
          currentTknWeight,
          flowUSDC,
        );

        usdcBalance += flowUSDC;
        tknBalance -= amountOut;
      }

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

// Worker message handler
self.onmessage = function (e) {
  if (e.data.type === "calculate") {
    try {
      const result = calculatePotentialPricePaths(
        e.data.config,
        e.data.demandPressureConfig,
        e.data.steps,
        e.data.scenarios,
      );
      self.postMessage({ type: "success", result });
    } catch (error) {
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
