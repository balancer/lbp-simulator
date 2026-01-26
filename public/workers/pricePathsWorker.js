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

function getDemandPressureCurve(hours, steps, config) {
  const curve = [];
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const growthFactor = Math.pow(progress, config.growthRate / 2);
    const intensity =
      config.floorIntensity +
      (config.baseIntensity - config.floorIntensity) * growthFactor;
    curve.push(Math.max(0, Math.min(1, intensity)));
  }
  return curve;
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

function calculateTradingVolume(
  demandPressure,
  priceDiscount,
  config,
) {
  const discountMultiplier = Math.max(
    0.5,
    1 + priceDiscount * config.priceDiscountMultiplier,
  );
  return demandPressure * discountMultiplier;
}

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
  const demandCurve = getDemandCurve(config.duration, steps);
  const baseData = calculateSimulationData(config, steps);

  for (const demandMultiplier of scenarios) {
    const path = [];
    let tknBalance = config.tknBalanceIn;
    let usdcBalance = config.usdcBalanceIn;

    for (let i = 0; i <= steps; i++) {
      const stepData = baseData[i];
      const progress = i / steps;

      const currentTknWeight =
        config.tknWeightIn +
        (config.tknWeightOut - config.tknWeightIn) * progress;
      const currentUsdcWeight =
        config.usdcWeightIn +
        (config.usdcWeightOut - config.usdcWeightIn) * progress;

      const currentPrice = calculateSpotPrice(
        usdcBalance,
        currentUsdcWeight,
        tknBalance,
        currentTknWeight,
      );

      const baseDemandPressure = demandPressureCurve[i];
      const fairPrice = demandCurve[i];

      const adjustedDemandPressure = Math.min(
        1,
        baseDemandPressure * demandMultiplier,
      );

      const priceDiscount =
        currentPrice < fairPrice ? (fairPrice - currentPrice) / fairPrice : 0;

      const baseVolume = calculateTradingVolume(
        adjustedDemandPressure,
        priceDiscount,
        demandPressureConfig,
      );

      const expectedBuyVolume =
        baseVolume * demandPressureConfig.baseTradeSize * adjustedDemandPressure;

      if (expectedBuyVolume > 0 && currentPrice < fairPrice) {
        const amountOut = calculateOutGivenIn(
          usdcBalance,
          currentUsdcWeight,
          tknBalance,
          currentTknWeight,
          expectedBuyVolume,
        );

        usdcBalance += expectedBuyVolume;
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
