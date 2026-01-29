// Web Worker: deterministic LBP simulation with buy & sell pressure
// Produces a full path of pool state snapshots for use on the main thread.

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

  const multiplier = clampNumber(config.multiplier ?? 1, 0, 1_000_000);
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
  const a = clampedConc / 100; // 0..1

  const sigmaMax = 0.25; // bem suave
  const sigmaMin = Math.max(1 / safeSteps, 0.03); // evita ficar "needle" demais / instável
  const sigma = sigmaMax + (sigmaMin - sigmaMax) * a;

  const gauss = (t) => Math.exp(-0.5 * (t / sigma) ** 2);

  const bumpAtEdge = gauss(0) + gauss(1); // ~ 1 + quase 0
  const bumpScale = bumpAtEdge > 0 ? 1 / bumpAtEdge : 1;

  const weights = new Array(safeSteps + 1);
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
 * Run deterministic LBP simulation with buy & sell pressure.
 * No user orders here – just bots/community.
 */
function runDeterministicSimulation(config, demandConfig, sellConfig, steps) {
  const snapshots = [];
  const safeSteps = Math.max(1, steps);

  const {
    tknBalanceIn,
    tknWeightIn,
    usdcBalanceIn,
    usdcWeightIn,
    tknWeightOut,
    usdcWeightOut,
    duration,
  } = config;

  let tknBalance = tknBalanceIn;
  let usdcBalance = usdcBalanceIn;
  let communityTokensHeld = 0;
  let communityAvgCost = 0;

  const buyFlowCurve = getDemandPressureCurve(
    duration,
    safeSteps,
    demandConfig,
  );

  const loyalSchedule = getLoyalSellSchedule(
    duration,
    safeSteps,
    sellConfig.loyalConcentrationPct,
  );

  for (let i = 0; i <= safeSteps; i++) {
    const progress = i / safeSteps;
    const time = progress * duration;

    const currentTknWeight =
      tknWeightIn + (tknWeightOut - tknWeightIn) * progress;
    const currentUsdcWeight =
      usdcWeightIn + (usdcWeightOut - usdcWeightIn) * progress;

    // Per-step bot volumes (for logging in UI)
    let stepBuyUSDC = 0;
    let stepBuyTKN = 0;
    let stepSellUSDC = 0;
    let stepSellTKN = 0;

    // --- BUY PRESSURE (community buys) ---
    const flowUSDC = buyFlowCurve[i] || 0;
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
        const newTokens = communityTokensHeld + amountOut;
        communityAvgCost =
          newTokens > 0
            ? (communityAvgCost * communityTokensHeld +
                pricePaid * amountOut) /
              newTokens
            : communityAvgCost;
        communityTokensHeld = newTokens;
        stepBuyUSDC += flowUSDC;
        stepBuyTKN += amountOut;
      }
    }

    // Price after buys
    let price = calculateSpotPrice(
      usdcBalance,
      currentUsdcWeight,
      tknBalance,
      currentTknWeight,
    );

    // --- SELL PRESSURE (community sells) ---
    if (sellConfig.preset === "loyal") {
      const weight = loyalSchedule[i] || 0;
      if (
        weight > 0 &&
        communityTokensHeld > 0 &&
        sellConfig.loyalSoldPct > 0
      ) {
        // Calculate target total tokens to sell over entire campaign
        const totalTargetSellTokens =
          tknBalanceIn * (sellConfig.loyalSoldPct / 100);
        // Distribute using schedule weights (they sum to 1)
        const stepTargetTokens = totalTargetSellTokens * weight;
        
        // Sell a meaningful amount: use schedule weight to determine intensity
        // Higher weight (edges) = more aggressive selling
        // Scale weight to get a reasonable sell fraction (0.1% to 10% of holdings)
        const sellFraction = Math.min(
          0.1, // Cap at 10% of holdings per step
          Math.max(0.001, weight * 100), // Scale weight to get 0.1% to 10% range
        );
        const amountToken = Math.min(
          communityTokensHeld * sellFraction,
          stepTargetTokens * 5, // Allow up to 5x target for visibility
        );
        
        if (amountToken > 0 && amountToken >= 1) { // Only sell if meaningful amount
          const amountOut = calculateOutGivenIn(
            tknBalance,
            currentTknWeight,
            usdcBalance,
            currentUsdcWeight,
            amountToken,
          );
          tknBalance += amountToken;
          usdcBalance -= amountOut;

          communityTokensHeld = Math.max(
            0,
            communityTokensHeld - amountToken,
          );
          if (communityTokensHeld === 0) communityAvgCost = 0;

          stepSellUSDC += amountOut;
          stepSellTKN += amountToken;

          price = calculateSpotPrice(
            usdcBalance,
            currentUsdcWeight,
            tknBalance,
            currentTknWeight,
          );
        }
      }
    } else if (sellConfig.preset === "greedy") {
      if (communityTokensHeld > 0) {
        // Greedy: sell when profitable OR continuously if we have significant holdings
        let shouldSell = false;
        let sellFraction = 0;
        
        if (communityAvgCost > 0) {
          const threshold =
            communityAvgCost * (1 + sellConfig.greedySpreadPct / 100);
          if (price >= threshold) {
            // Profitable: sell aggressively
            shouldSell = true;
            sellFraction = Math.min(1, sellConfig.greedySellPct / 100);
          }
        }
        
        // Fallback: if we have accumulated significant holdings, sell continuously
        // This ensures sells happen and affect price even in declining markets
        if (!shouldSell && communityTokensHeld > tknBalanceIn * 0.02) {
          // Sell a small fraction continuously when holdings are significant
          shouldSell = true;
          sellFraction = Math.min(0.05, sellConfig.greedySellPct / 100); // 5% max for continuous sells
        }

        if (shouldSell && sellFraction > 0) {
          const amountToken = communityTokensHeld * sellFraction;
          if (amountToken > 0 && amountToken >= 1) {
            const amountOut = calculateOutGivenIn(
              tknBalance,
              currentTknWeight,
              usdcBalance,
              currentUsdcWeight,
              amountToken,
            );
            tknBalance += amountToken;
            usdcBalance -= amountOut;

            communityTokensHeld = Math.max(
              0,
              communityTokensHeld - amountToken,
            );
            if (communityTokensHeld === 0) communityAvgCost = 0;

            stepSellUSDC += amountOut;
            stepSellTKN += amountToken;

            price = calculateSpotPrice(
              usdcBalance,
              currentUsdcWeight,
              tknBalance,
              currentTknWeight,
            );
          }
        }
      }
    }

    snapshots.push({
      index: i,
      time,
      timeLabel: `${time.toFixed(1)}h`,
      price,
      tknBalance,
      usdcBalance,
      tknWeight: currentTknWeight,
      usdcWeight: currentUsdcWeight,
      communityTokensHeld,
      communityAvgCost,
      buyVolumeUSDC: stepBuyUSDC,
      buyVolumeTKN: stepBuyTKN,
      sellVolumeUSDC: stepSellUSDC,
      sellVolumeTKN: stepSellTKN,
    });
  }

  return snapshots;
}

// Worker message handler
self.onmessage = function (e) {
  if (e.data.type === "run-simulation") {
    try {
      const { config, demandPressureConfig, sellPressureConfig, steps } =
        e.data;
      const result = runDeterministicSimulation(
        config,
        demandPressureConfig,
        sellPressureConfig,
        steps,
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

