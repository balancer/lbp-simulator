#!/usr/bin/env node

/**
 * Quick Validation Script
 *
 * Run this before deploying to catch obvious issues.
 * This script runs key validation scenarios and reports pass/fail.
 */

import {
  calculateSpotPrice,
  calculateOutGivenIn,
  getCumulativeBuyPressureCurve,
  getPerStepBuyFlowFromCumulative,
  getLoyalSellSchedule,
} from "../lib/lbp-math.ts";

const EPSILON = 0.0001;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}

function assertClose(actual, expected, tolerance = EPSILON, message = "") {
  const diff = Math.abs(actual - expected);
  const relDiff = expected !== 0 ? diff / Math.abs(expected) : diff;
  if (relDiff > tolerance) {
    throw new ValidationError(
      `${message}\nExpected: ${expected}\nActual: ${actual}\nDiff: ${diff} (${(
        relDiff * 100
      ).toFixed(4)}%)`,
    );
  }
}

console.log("🧪 Running Quick Validation...\n");

let passed = 0;
let failed = 0;

function runTest(name, testFn) {
  try {
    testFn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   ${error.message}\n`);
    failed++;
  }
}

// Test 1: Value Function Preservation
runTest("Value function preserved after swaps", () => {
  const balanceIn = 100000;
  const weightIn = 10;
  const balanceOut = 1000000;
  const weightOut = 90;
  const amountIn = 10000;

  const V_before =
    Math.pow(balanceIn, weightIn / 100) * Math.pow(balanceOut, weightOut / 100);

  const amountOut = calculateOutGivenIn(
    balanceIn,
    weightIn,
    balanceOut,
    weightOut,
    amountIn,
  );

  const newBalanceIn = balanceIn + amountIn;
  const newBalanceOut = balanceOut - amountOut;
  const V_after =
    Math.pow(newBalanceIn, weightIn / 100) *
    Math.pow(newBalanceOut, weightOut / 100);

  assertClose(V_after, V_before, 0.0001, "Value function not preserved");
});

// Test 2: Price Increases After Buy
runTest("Price increases after buying", () => {
  const usdcBalance = 100000;
  const usdcWeight = 10;
  const tknBalance = 1000000;
  const tknWeight = 90;

  const priceBefore = calculateSpotPrice(
    usdcBalance,
    usdcWeight,
    tknBalance,
    tknWeight,
  );

  const amountIn = 10000;
  const amountOut = calculateOutGivenIn(
    usdcBalance,
    usdcWeight,
    tknBalance,
    tknWeight,
    amountIn,
  );

  const priceAfter = calculateSpotPrice(
    usdcBalance + amountIn,
    usdcWeight,
    tknBalance - amountOut,
    tknWeight,
  );

  assert(
    priceAfter > priceBefore,
    `Price should increase. Before: ${priceBefore}, After: ${priceAfter}`,
  );
});

// Test 3: Cumulative Curve Properties
runTest("Cumulative buy curve is monotonic", () => {
  const config = { preset: "bullish", magnitudeBase: 100000, multiplier: 1 };
  const curve = getCumulativeBuyPressureCurve(48, 100, config);

  for (let i = 1; i < curve.length; i++) {
    assert(
      curve[i] >= curve[i - 1],
      `Curve not monotonic at step ${i}: ${curve[i]} < ${curve[i - 1]}`,
    );
  }

  assertClose(curve[0], 0, EPSILON, "Curve should start at 0");
  assertClose(
    curve[curve.length - 1],
    100000,
    EPSILON,
    "Curve should end at 100k",
  );
});

// Test 4: Per-Step Flow Sum
runTest("Per-step flow sums to cumulative total", () => {
  const config = { preset: "bullish", magnitudeBase: 150000, multiplier: 1 };
  const cumulative = getCumulativeBuyPressureCurve(48, 100, config);
  const flow = getPerStepBuyFlowFromCumulative(cumulative);

  const totalFlow = flow.reduce((sum, f) => sum + f, 0);
  const expectedTotal = cumulative[cumulative.length - 1];

  assertClose(
    totalFlow,
    expectedTotal,
    0.001,
    "Flow sum does not match cumulative",
  );
});

// Test 5: Loyal Schedule Normalization
runTest("Loyal sell schedule sums to 1", () => {
  const schedule = getLoyalSellSchedule(48, 100, 60);
  const sum = schedule.reduce((acc, w) => acc + w, 0);

  assertClose(sum, 1, 0.0001, "Schedule weights should sum to 1");

  // All weights should be non-negative
  for (let i = 0; i < schedule.length; i++) {
    assert(schedule[i] >= 0, `Negative weight at index ${i}: ${schedule[i]}`);
  }
});

// Test 6: Slippage Increases with Trade Size
runTest("Slippage increases with trade size", () => {
  const balanceIn = 100000;
  const weightIn = 10;
  const balanceOut = 1000000;
  const weightOut = 90;

  const spotPrice = calculateSpotPrice(
    balanceIn,
    weightIn,
    balanceOut,
    weightOut,
  );

  const smallTrade = 1000;
  const largeTrade = 50000;

  const smallOut = calculateOutGivenIn(
    balanceIn,
    weightIn,
    balanceOut,
    weightOut,
    smallTrade,
  );
  const largeOut = calculateOutGivenIn(
    balanceIn,
    weightIn,
    balanceOut,
    weightOut,
    largeTrade,
  );

  const smallEffective = smallTrade / smallOut;
  const largeEffective = largeTrade / largeOut;

  const smallSlippage = Math.abs(smallEffective - spotPrice) / spotPrice;
  const largeSlippage = Math.abs(largeEffective - spotPrice) / spotPrice;

  assert(
    largeSlippage > smallSlippage,
    `Large trade slippage (${largeSlippage}) should be greater than small trade (${smallSlippage})`,
  );
});

// Test 7: Weight Change Impact (token weight 90→50 decreases spot price)
runTest("Price decreases when token weight goes from 90 to 50", () => {
  const usdcBalance = 100000;
  const tknBalance = 1000000;

  const price1 = calculateSpotPrice(usdcBalance, 10, tknBalance, 90);
  const price2 = calculateSpotPrice(usdcBalance, 50, tknBalance, 50);

  assert(
    price2 < price1,
    `Price with 50/50 weights (${price2}) should be lower than 10/90 (${price1})`,
  );
});

// Test 8: Zero Input Edge Case
runTest("Zero input returns zero output", () => {
  const result = calculateOutGivenIn(100000, 10, 1000000, 90, 0);
  assertClose(result, 0, EPSILON, "Zero input should return zero output");
});

// Test 9: Very Large Trade Stability
runTest("Very large trades remain stable", () => {
  const balanceIn = 100000;
  const weightIn = 10;
  const balanceOut = 1000000;
  const weightOut = 90;
  const amountIn = 10000000; // 100x pool size

  const result = calculateOutGivenIn(
    balanceIn,
    weightIn,
    balanceOut,
    weightOut,
    amountIn,
  );

  assert(
    result < balanceOut,
    `Output ${result} should be less than pool balance ${balanceOut}`,
  );
  assert(result > 0, "Output should be positive");
  assert(isFinite(result), "Result should be finite");
});

// Test 10: Bearish vs Bullish Total
runTest("Bearish has lower total than bullish", () => {
  const bullish = { preset: "bullish", magnitudeBase: 100000, multiplier: 1 };
  const bearish = { preset: "bearish", magnitudeBase: 100000, multiplier: 1 };

  const bullishCurve = getCumulativeBuyPressureCurve(48, 100, bullish);
  const bearishCurve = getCumulativeBuyPressureCurve(48, 100, bearish);

  const bullishTotal = bullishCurve[bullishCurve.length - 1];
  const bearishTotal = bearishCurve[bearishCurve.length - 1];

  assert(
    bearishTotal < bullishTotal,
    `Bearish total (${bearishTotal}) should be less than bullish (${bullishTotal})`,
  );
});

// Summary
console.log("\n" + "=".repeat(50));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log("=".repeat(50));

if (failed === 0) {
  console.log("\n🎉 All validations passed! Safe to deploy.\n");
  process.exit(0);
} else {
  console.log("\n⚠️  Some validations failed. Please fix before deploying.\n");
  process.exit(1);
}
