import { describe, it, expect } from "vitest";
import {
  calculateSpotPrice,
  calculateOutGivenIn,
  calcSpotPriceTokenInCollateral,
  calcTVLUSD,
  getCumulativeBuyPressureCurve,
  getPerStepBuyFlowFromCumulative,
  getLoyalSellSchedule,
  type LBPConfig,
  type DemandPressureConfig,
} from "../lib/lbp-math";

describe("LBP Math Invariants", () => {
  describe("Balancer Core Formulas", () => {
    // Assumes no swap fee; see fee-aware test below.
    it("should maintain value function V = B_i^w_i * B_o^w_o after swaps", () => {
      const balanceIn = 100000; // USDC
      const weightIn = 10;
      const balanceOut = 1000000; // TKN
      const weightOut = 90;
      const amountIn = 10000;

      // Calculate initial value function
      const V_before =
        Math.pow(balanceIn, weightIn / 100) *
        Math.pow(balanceOut, weightOut / 100);

      // Execute swap
      const amountOut = calculateOutGivenIn(
        balanceIn,
        weightIn,
        balanceOut,
        weightOut,
        amountIn,
      );

      // Calculate value function after swap
      const newBalanceIn = balanceIn + amountIn;
      const newBalanceOut = balanceOut - amountOut;
      const V_after =
        Math.pow(newBalanceIn, weightIn / 100) *
        Math.pow(newBalanceOut, weightOut / 100);

      // Value function should be preserved (within numerical precision)
      expect(Math.abs(V_after - V_before) / V_before).toBeLessThan(0.0001);
      console.log(
        "  → V_before:",
        V_before,
        "V_after:",
        V_after,
        "amountOut:",
        amountOut,
      );
    });

    it("should maintain value function when caller applies swap fee (amountInAfterFee)", () => {
      const balanceIn = 100000;
      const weightIn = 10;
      const balanceOut = 1000000;
      const weightOut = 90;
      const amountIn = 10000;
      const swapFee = 0.01;
      const amountInAfterFee = amountIn * (1 - swapFee);

      const V_before =
        Math.pow(balanceIn, weightIn / 100) *
        Math.pow(balanceOut, weightOut / 100);

      const amountOut = calculateOutGivenIn(
        balanceIn,
        weightIn,
        balanceOut,
        weightOut,
        amountInAfterFee,
      );

      const newBalanceIn = balanceIn + amountInAfterFee;
      const newBalanceOut = balanceOut - amountOut;
      const V_after =
        Math.pow(newBalanceIn, weightIn / 100) *
        Math.pow(newBalanceOut, weightOut / 100);

      expect(Math.abs(V_after - V_before) / V_before).toBeLessThan(0.0001);
    });

    it("spot price should increase after buying token", () => {
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

      // Buy some tokens
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

      expect(priceAfter).toBeGreaterThan(priceBefore);
      console.log(
        "  → priceBefore:",
        priceBefore,
        "priceAfter:",
        priceAfter,
        "amountOut:",
        amountOut,
      );
    });

    it("should return zero tokens when buying with zero USDC", () => {
      const result = calculateOutGivenIn(100000, 10, 1000000, 90, 0);
      expect(result).toBe(0);
    });

    it("should return reasonable slippage for small trades", () => {
      const balanceIn = 100000;
      const weightIn = 10;
      const balanceOut = 1000000;
      const weightOut = 90;
      const amountIn = 100; // Small trade: 0.1% of pool

      const priceBefore = calculateSpotPrice(
        balanceIn,
        weightIn,
        balanceOut,
        weightOut,
      );
      const amountOut = calculateOutGivenIn(
        balanceIn,
        weightIn,
        balanceOut,
        weightOut,
        amountIn,
      );
      const effectivePrice = amountIn / amountOut;

      // For small trades, slippage should be minimal
      const slippage = (effectivePrice - priceBefore) / priceBefore;
      expect(slippage).toBeLessThan(0.01); // Less than 1% slippage
      console.log(
        "  → priceBefore:",
        priceBefore,
        "amountOut:",
        amountOut,
        "effectivePrice:",
        effectivePrice,
        "slippage:",
        (slippage * 100).toFixed(4) + "%",
      );
    });

    it("spot price ratio should scale with token weight ratio (weighted formula)", () => {
      const usdcBalance = 100000;
      const tknBalance = 1000000;

      // Weighted spot price: price ∝ 1/tknWeight for fixed balances. Token 10%→20% => price ~2x.
      const price1 = calculateSpotPrice(usdcBalance, 90, tknBalance, 10);
      const price2 = calculateSpotPrice(usdcBalance, 80, tknBalance, 20);

      const ratio = price2 / price1;
      expect(ratio).toBeGreaterThan(1.8);
      expect(ratio).toBeLessThan(2.3);
      console.log(
        "  → price1 (tkn 10%):",
        price1,
        "price2 (tkn 20%):",
        price2,
        "ratio:",
        ratio.toFixed(4),
      );
    });
  });

  describe("Weight schedule", () => {
    it("LBP weight should interpolate linearly in time", () => {
      const duration = 48;
      const steps = 100;
      const tknWeightIn = 90;
      const tknWeightOut = 10;

      const at = (i: number) => {
        const progress = i / steps;
        return tknWeightIn + (tknWeightOut - tknWeightIn) * progress;
      };

      expect(at(0)).toBe(90);
      expect(at(steps)).toBe(10);
      expect(at(steps / 2)).toBe(50);
    });
  });

  describe("Weight Normalization", () => {
    it("should handle percentage weights (0-100) correctly", () => {
      const price1 = calculateSpotPrice(100000, 10, 1000000, 90);
      const price2 = calculateSpotPrice(100000, 0.1, 1000000, 0.9);

      // Both representations should yield the same price
      expect(Math.abs(price1 - price2) / price1).toBeLessThan(0.0001);
      console.log("  → price (10/90):", price1, "price (0.1/0.9):", price2);
    });
  });

  describe("TVL Calculations", () => {
    it("should calculate TVL correctly for stablecoin collateral", () => {
      const config: LBPConfig = {
        tokenName: "TEST",
        tokenSymbol: "TST",
        totalSupply: 10000000,
        percentForSale: 10,
        collateralToken: "USDC",
        tknBalanceIn: 1000000,
        tknWeightIn: 90,
        usdcBalanceIn: 100000,
        usdcWeightIn: 10,
        tknWeightOut: 10,
        usdcWeightOut: 90,
        startDelay: 0,
        duration: 48,
        swapFee: 0.01,
        creatorFee: 5,
      };

      const { tvlUsd, tokenPriceUsd } = calcTVLUSD(config);

      // TVL should equal USDC + (TKN balance * token price)
      const expectedTVL =
        config.usdcBalanceIn + config.tknBalanceIn * tokenPriceUsd;
      expect(Math.abs(tvlUsd - expectedTVL) / tvlUsd).toBeLessThan(0.0001);
      console.log(
        "  → tokenPriceUsd:",
        tokenPriceUsd,
        "tvlUsd:",
        tvlUsd,
        "expectedTVL:",
        expectedTVL,
      );
    });

    it("should handle ETH collateral with price conversion", () => {
      const config: LBPConfig = {
        tokenName: "TEST",
        tokenSymbol: "TST",
        totalSupply: 10000000,
        percentForSale: 10,
        collateralToken: "ETH",
        tknBalanceIn: 1000000,
        tknWeightIn: 90,
        usdcBalanceIn: 50, // 50 ETH
        usdcWeightIn: 10,
        tknWeightOut: 10,
        usdcWeightOut: 90,
        startDelay: 0,
        duration: 48,
        swapFee: 0.01,
        creatorFee: 5,
      };

      const ethPrice = 3000; // $3000 per ETH
      const { tvlUsd } = calcTVLUSD(
        config,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          collateralUsd: ethPrice,
        },
      );

      // TVL should be at least the ETH value
      expect(tvlUsd).toBeGreaterThan(config.usdcBalanceIn * ethPrice);
      console.log(
        "  → tvlUsd:",
        tvlUsd,
        "ETH value:",
        config.usdcBalanceIn * ethPrice,
      );
    });
  });

  describe("Demand Pressure Curves", () => {
    it("cumulative buy curve should be monotonically increasing", () => {
      const config: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 1,
      };

      const curve = getCumulativeBuyPressureCurve(48, 100, config);

      for (let i = 1; i < curve.length; i++) {
        expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
      }
      console.log(
        "  → curve[0]:",
        curve[0],
        "curve[last]:",
        curve[curve.length - 1],
      );
    });

    it("cumulative buy curve should start at 0 and end at total USDC", () => {
      const config: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 2,
      };

      const curve = getCumulativeBuyPressureCurve(48, 100, config);

      expect(curve[0]).toBe(0);
      expect(curve[curve.length - 1]).toBe(200000); // 100k * 2
      console.log(
        "  → curve[0]:",
        curve[0],
        "curve[last]:",
        curve[curve.length - 1],
      );
    });

    it("per-step flow should be non-negative", () => {
      const config: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 1,
      };

      const cumulative = getCumulativeBuyPressureCurve(48, 100, config);
      const flow = getPerStepBuyFlowFromCumulative(cumulative);

      flow.forEach((f) => {
        expect(f).toBeGreaterThanOrEqual(0);
      });
    });

    it("sum of per-step flow should equal total cumulative", () => {
      const config: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 1.5,
      };

      const cumulative = getCumulativeBuyPressureCurve(48, 100, config);
      const flow = getPerStepBuyFlowFromCumulative(cumulative);

      const totalFlow = flow.reduce((sum, f) => sum + f, 0);
      const expectedTotal = cumulative[cumulative.length - 1];

      expect(Math.abs(totalFlow - expectedTotal) / expectedTotal).toBeLessThan(
        0.0001,
      );
      console.log("  → totalFlow:", totalFlow, "expectedTotal:", expectedTotal);
    });

    it("bearish preset should have lower total than bullish", () => {
      const bullish: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 1,
      };

      const bearish: DemandPressureConfig = {
        preset: "bearish",
        magnitudeBase: 100000,
        multiplier: 1,
      };

      const bullishCurve = getCumulativeBuyPressureCurve(48, 100, bullish);
      const bearishCurve = getCumulativeBuyPressureCurve(48, 100, bearish);

      expect(bearishCurve[bearishCurve.length - 1]).toBeLessThan(
        bullishCurve[bullishCurve.length - 1],
      );
      console.log(
        "  → bearish total:",
        bearishCurve[bearishCurve.length - 1],
        "bullish total:",
        bullishCurve[bullishCurve.length - 1],
      );
    });
  });

  describe("Loyal Sell Schedule", () => {
    it("should sum to 1 (normalized weights)", () => {
      const schedule = getLoyalSellSchedule(48, 100, 60);
      const sum = schedule.reduce((acc, w) => acc + w, 0);

      expect(Math.abs(sum - 1)).toBeLessThan(0.0001);
      console.log("  → schedule sum:", sum);
    });

    it("should be non-negative", () => {
      const schedule = getLoyalSellSchedule(48, 100, 60);

      schedule.forEach((w) => {
        expect(w).toBeGreaterThanOrEqual(0);
      });
    });

    it("higher concentration should create more weight at edges", () => {
      const lowConc = getLoyalSellSchedule(48, 100, 20);
      const highConc = getLoyalSellSchedule(48, 100, 80);

      // First and last elements should have higher weight in high concentration
      expect(highConc[0]).toBeGreaterThan(lowConc[0]);
      expect(highConc[100]).toBeGreaterThan(lowConc[100]);

      // Middle elements should have lower weight in high concentration
      expect(highConc[50]).toBeLessThan(lowConc[50]);
      console.log(
        "  → highConc[0]:",
        highConc[0],
        "lowConc[0]:",
        lowConc[0],
        "highConc[50]:",
        highConc[50],
        "lowConc[50]:",
        lowConc[50],
      );
    });
  });

  describe("Edge Cases", () => {
    // Returning 0 for spot price when balance or weight is zero is a deliberate safety/UX
    // choice (avoids Infinity/NaN), not a mathematical definition.
    it("should handle zero balances gracefully", () => {
      const a = calculateSpotPrice(0, 10, 1000000, 90);
      const b = calculateSpotPrice(100000, 10, 0, 90);
      expect(a).toBe(0);
      expect(b).toBe(0);
      console.log(
        "  → spotPrice(0 balance):",
        a,
        "spotPrice(0 tknBalance):",
        b,
      );
    });

    it("should handle zero weights gracefully", () => {
      const a = calculateSpotPrice(100000, 0, 1000000, 90);
      const b = calculateSpotPrice(100000, 10, 1000000, 0);
      expect(a).toBe(0);
      expect(b).toBe(0);
      console.log("  → spotPrice(usdcW=0):", a, "spotPrice(tknW=0):", b);
    });

    it("should handle very large trades without overflow", () => {
      const balanceIn = 100000;
      const weightIn = 10;
      const balanceOut = 1000000;
      const weightOut = 90;
      const amountIn = 1000000; // 10x the pool size

      const result = calculateOutGivenIn(
        balanceIn,
        weightIn,
        balanceOut,
        weightOut,
        amountIn,
      );

      // Should not exceed the pool balance
      expect(result).toBeLessThan(balanceOut);
      expect(result).toBeGreaterThan(0);
      expect(isFinite(result)).toBe(true);
      console.log(
        "  → amountIn: 1M, amountOut:",
        result,
        "balanceOut:",
        balanceOut,
      );
    });

    it("should handle very small trades accurately", () => {
      const balanceIn = 100000;
      const weightIn = 10;
      const balanceOut = 1000000;
      const weightOut = 90;
      const amountIn = 0.01;

      const result = calculateOutGivenIn(
        balanceIn,
        weightIn,
        balanceOut,
        weightOut,
        amountIn,
      );

      expect(result).toBeGreaterThan(0);
      expect(isFinite(result)).toBe(true);
      const spotPrice = calculateSpotPrice(
        balanceIn,
        weightIn,
        balanceOut,
        weightOut,
      );
      console.log(
        "  → amountIn: 0.01, amountOut:",
        result,
        "spotPrice:",
        spotPrice,
      );
    });
  });
});
