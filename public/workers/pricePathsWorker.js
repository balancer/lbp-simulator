// Web Worker for calculating potential price paths
// This runs off the main thread to keep UI responsive

// Math functions - self-contained in the worker
function calculateSpotPrice(usdcBalance, usdcWeight, tknBalance, tknWeight) {
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

function getLoyalSellSchedule(hours, steps, concentrationPct) {
  const safeSteps = Math.max(1, steps);
  const clampedConc = clampNumber(concentrationPct, 0, 100);
  const a = clampedConc / 100;
  const sigmaMax = 0.25;
  const sigmaMin = Math.max(1 / safeSteps, 0.03);
  const sigma = sigmaMax + (sigmaMin - sigmaMax) * a;
  const gauss = (t) => Math.exp(-0.5 * (t / sigma) ** 2);
  const bumpAtEdge = gauss(0) + gauss(1);
  const bumpScale = bumpAtEdge > 0 ? 1 / bumpAtEdge : 1;
  const weights = new Array(safeSteps + 1);
  for (let i = 0; i <= safeSteps; i++) {
    const x = i / safeSteps;
    const bump = (gauss(x) + gauss(1 - x)) * bumpScale;
    weights[i] = 1 + a * bump;
  }
  const total = weights.reduce((acc, w) => acc + w, 0);
  if (total === 0) return new Array(safeSteps + 1).fill(0);
  return weights.map((w) => w / total);
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

// Apply sell pressure for one step (mirrors simulationWorker loyal/greedy logic).
function applySellPressure(
  sellConfig,
  loyalSchedule,
  i,
  config,
  tknBalance,
  usdcBalance,
  currentTknWeight,
  currentUsdcWeight,
  communityTokensHeld,
  communityAvgCost,
  priceAfterBuys,
) {
  let tknBal = tknBalance;
  let usdcBal = usdcBalance;
  let communityHeld = communityTokensHeld;
  let communityCost = communityAvgCost;
  let price = priceAfterBuys;

  if (sellConfig.preset === "loyal") {
    const weight = loyalSchedule[i] || 0;
    if (weight > 0 && communityHeld > 0 && sellConfig.loyalSoldPct > 0) {
      const totalTargetSellTokens =
        config.tknBalanceIn * (sellConfig.loyalSoldPct / 100);
      const stepTargetTokens = totalTargetSellTokens * weight;
      const sellFraction = Math.min(0.1, Math.max(0.001, weight * 100));
      const amountToken = Math.min(
        communityHeld * sellFraction,
        stepTargetTokens * 5,
      );
      if (amountToken > 0 && amountToken >= 1) {
        const amountOut = calculateOutGivenIn(
          tknBal,
          currentTknWeight,
          usdcBal,
          currentUsdcWeight,
          amountToken,
        );
        tknBal += amountToken;
        usdcBal -= amountOut;
        communityHeld = Math.max(0, communityHeld - amountToken);
        if (communityHeld === 0) communityCost = 0;
        price = calculateSpotPrice(
          usdcBal,
          currentUsdcWeight,
          tknBal,
          currentTknWeight,
        );
      }
    }
  } else if (sellConfig.preset === "greedy" && communityHeld > 0) {
    let shouldSell = false;
    let sellFraction = 0;
    if (communityCost > 0) {
      const threshold = communityCost * (1 + sellConfig.greedySpreadPct / 100);
      if (price >= threshold) {
        shouldSell = true;
        sellFraction = Math.min(1, sellConfig.greedySellPct / 100);
      }
    }
    if (!shouldSell && communityHeld > config.tknBalanceIn * 0.02) {
      shouldSell = true;
      sellFraction = Math.min(0.05, sellConfig.greedySellPct / 100);
    }
    if (shouldSell && sellFraction > 0) {
      const amountToken = communityHeld * sellFraction;
      if (amountToken > 0 && amountToken >= 1) {
        const amountOut = calculateOutGivenIn(
          tknBal,
          currentTknWeight,
          usdcBal,
          currentUsdcWeight,
          amountToken,
        );
        tknBal += amountToken;
        usdcBal -= amountOut;
        communityHeld = Math.max(0, communityHeld - amountToken);
        if (communityHeld === 0) communityCost = 0;
        price = calculateSpotPrice(
          usdcBal,
          currentUsdcWeight,
          tknBal,
          currentTknWeight,
        );
      }
    }
  }

  return {
    tknBalance: tknBal,
    usdcBalance: usdcBal,
    communityTokensHeld: communityHeld,
    communityAvgCost: communityCost,
    price,
  };
}

// Main calculation function
// Computes potential price paths starting from a given currentStep.
// Scenarios are interpreted as **multipliers** [0, 1, 2] applied
// to the per-step buy flow derived from DemandPressureConfig for the
// remaining duration of the LBP. Sell pressure is applied the same as
// the main simulation so the worst path (0 buy) is the true floor.
function calculatePotentialPricePaths(
  config,
  demandPressureConfig,
  sellPressureConfig,
  steps,
  scenarios,
  currentStep,
  currentStepState,
) {
  const paths = [];
  const totalSteps = Math.max(0, steps | 0);
  const startStep = Math.max(0, Math.min(totalSteps, currentStep | 0));

  if (startStep > totalSteps) {
    return paths;
  }

  const demandPressureCurve = getDemandPressureCurve(
    config.duration,
    totalSteps,
    demandPressureConfig,
  );

  const loyalSchedule = getLoyalSellSchedule(
    config.duration,
    totalSteps,
    sellPressureConfig.loyalConcentrationPct ?? 60,
  );

  // Starting balances and community state at the pause point.
  const startTknBalance =
    currentStepState && typeof currentStepState.tknBalance === "number"
      ? currentStepState.tknBalance
      : config.tknBalanceIn;
  const startUsdcBalance =
    currentStepState && typeof currentStepState.usdcBalance === "number"
      ? currentStepState.usdcBalance
      : config.usdcBalanceIn;
  let communityTokensHeld =
    currentStepState && typeof currentStepState.communityTokensHeld === "number"
      ? currentStepState.communityTokensHeld
      : 0;
  let communityAvgCost =
    currentStepState && typeof currentStepState.communityAvgCost === "number"
      ? currentStepState.communityAvgCost
      : 0;

  const remainingSteps = Math.max(1, totalSteps - startStep);

  for (const scenarioFactor of scenarios) {
    const path = [];

    let tknBalance = startTknBalance;
    let usdcBalance = startUsdcBalance;
    let commHeld = communityTokensHeld;
    let commCost = communityAvgCost;

    // First point: current step price (no extra flow at junction).
    const initialProgress = startStep / totalSteps;
    const initialTknWeight =
      config.tknWeightIn +
      (config.tknWeightOut - config.tknWeightIn) * initialProgress;
    const initialUsdcWeight =
      config.usdcWeightIn +
      (config.usdcWeightOut - config.usdcWeightIn) * initialProgress;
    const initialPrice = calculateSpotPrice(
      usdcBalance,
      initialUsdcWeight,
      tknBalance,
      initialTknWeight,
    );
    path.push(initialPrice);

    for (let i = startStep + 1; i <= totalSteps; i++) {
      const progress = i / totalSteps;
      const currentTknWeight =
        config.tknWeightIn +
        (config.tknWeightOut - config.tknWeightIn) * progress;
      const currentUsdcWeight =
        config.usdcWeightIn +
        (config.usdcWeightOut - config.usdcWeightIn) * progress;

      const flowUSDCBase = demandPressureCurve[i] || 0;
      const localIdx = i - startStep;
      const transitionProgress = Math.min(
        1,
        Math.max(0, localIdx / remainingSteps),
      );
      const effectiveFactor = 1 + (scenarioFactor - 1) * transitionProgress;
      const flowUSDC = flowUSDCBase * effectiveFactor;

      // --- BUY PRESSURE ---
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
        if (amountOut > 0) {
          const pricePaid = flowUSDC / amountOut;
          const newTokens = commHeld + amountOut;
          commCost =
            newTokens > 0
              ? (commCost * commHeld + pricePaid * amountOut) / newTokens
              : commCost;
          commHeld = newTokens;
        }
      }

      let priceAfterBuys = calculateSpotPrice(
        usdcBalance,
        currentUsdcWeight,
        tknBalance,
        currentTknWeight,
      );

      // --- SELL PRESSURE (same as main simulation) ---
      const afterSell = applySellPressure(
        sellPressureConfig,
        loyalSchedule,
        i,
        config,
        tknBalance,
        usdcBalance,
        currentTknWeight,
        currentUsdcWeight,
        commHeld,
        commCost,
        priceAfterBuys,
      );
      tknBalance = afterSell.tknBalance;
      usdcBalance = afterSell.usdcBalance;
      commHeld = afterSell.communityTokensHeld;
      commCost = afterSell.communityAvgCost;

      path.push(afterSell.price);
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
        e.data.sellPressureConfig ?? {
          preset: "loyal",
          loyalSoldPct: 5,
          loyalConcentrationPct: 60,
          greedySpreadPct: 2,
          greedySellPct: 100,
        },
        e.data.steps,
        e.data.scenarios,
        e.data.currentStep ?? 0,
        e.data.currentStepState ?? null,
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
