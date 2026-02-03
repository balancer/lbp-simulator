import { describe, it, expect } from "vitest";
import {
  calculateSpotPrice,
  calculateOutGivenIn,
  calcTVLUSD,
  type LBPConfig,
} from "../lib/lbp-math";

/**
 * Validation tests using real LBP parameters and expected behaviors.
 *
 * These tests are based on actual Balancer LBPs to ensure our simulation
 * produces realistic results.
 */
describe("Real LBP Validation", () => {
  // PERP parameters below are approximate / inspired by the historical LBP unless a primary
  // source (e.g. Etherscan pool, official blog) is linked; tests validate PERP-like behavior.
  describe("PERP Protocol LBP (December 2020)", () => {
    // PERP raised ~$1.8M with these approximate parameters
    const perpConfig: LBPConfig = {
      tokenName: "Perpetual Protocol",
      tokenSymbol: "PERP",
      totalSupply: 150000000,
      percentForSale: 5,
      collateralToken: "USDC",
      tknBalanceIn: 7500000, // 5% of 150M
      tknWeightIn: 96,
      usdcBalanceIn: 200000, // Initial ~$200k
      usdcWeightIn: 4,
      tknWeightOut: 25,
      usdcWeightOut: 75,
      startDelay: 0,
      duration: 72,
      swapFee: 0.01,
      creatorFee: 0,
    };

    it("should start with reasonable initial price", () => {
      const initialPrice = calculateSpotPrice(
        perpConfig.usdcBalanceIn,
        perpConfig.usdcWeightIn,
        perpConfig.tknBalanceIn,
        perpConfig.tknWeightIn,
      );

      // Initial price should be low (high token weight)
      expect(initialPrice).toBeGreaterThan(0);
      expect(initialPrice).toBeLessThan(2); // Reasonably low for given balances/weights
      console.log("  → PERP initialPrice:", initialPrice.toFixed(6));
    });

    it("should have price decrease from weight shift alone", () => {
      const initialPrice = calculateSpotPrice(
        perpConfig.usdcBalanceIn,
        perpConfig.usdcWeightIn,
        perpConfig.tknBalanceIn,
        perpConfig.tknWeightIn,
      );

      const finalPrice = calculateSpotPrice(
        perpConfig.usdcBalanceIn,
        perpConfig.usdcWeightOut,
        perpConfig.tknBalanceIn,
        perpConfig.tknWeightOut,
      );

      // PERP's weight schedule reduces token weight (96→25), so spot price decreases
      expect(finalPrice).toBeLessThan(initialPrice);
      console.log(
        "  → PERP initialPrice:",
        initialPrice.toFixed(6),
        "finalPrice:",
        finalPrice.toFixed(6),
      );
    });

    it("should be able to raise ~$1.8M with realistic buying", () => {
      // Simulate accumulating $1.8M in buys over the duration
      let tknBalance = perpConfig.tknBalanceIn;
      let usdcBalance = perpConfig.usdcBalanceIn;
      const targetRaise = 1800000;
      let totalBought = 0;

      // Simulate buying in 100 equal chunks
      const buyPerStep = targetRaise / 100;

      for (let i = 0; i < 100; i++) {
        const progress = i / 100;
        const currentTknWeight =
          perpConfig.tknWeightIn +
          (perpConfig.tknWeightOut - perpConfig.tknWeightIn) * progress;
        const currentUsdcWeight =
          perpConfig.usdcWeightIn +
          (perpConfig.usdcWeightOut - perpConfig.usdcWeightIn) * progress;

        const amountOut = calculateOutGivenIn(
          usdcBalance,
          currentUsdcWeight,
          tknBalance,
          currentTknWeight,
          buyPerStep,
        );

        usdcBalance += buyPerStep;
        tknBalance -= amountOut;
        totalBought += buyPerStep;
      }

      // Should accumulate close to target
      expect(totalBought).toBeCloseTo(targetRaise, -3);
      expect(usdcBalance).toBeCloseTo(
        perpConfig.usdcBalanceIn + targetRaise,
        -3,
      );

      // Should have sold less than total token supply
      const tokensSold = perpConfig.tknBalanceIn - tknBalance;
      expect(tokensSold).toBeLessThan(perpConfig.tknBalanceIn);
      expect(tokensSold).toBeGreaterThan(0);
      console.log(
        "  → totalBought:",
        totalBought,
        "usdcBalance:",
        usdcBalance.toFixed(0),
        "tokensSold:",
        tokensSold.toFixed(0),
      );
    });

    it("average price should be reasonable", () => {
      // Simulate the full sale
      let tknBalance = perpConfig.tknBalanceIn;
      let usdcBalance = perpConfig.usdcBalanceIn;
      const targetRaise = 1800000;
      const buyPerStep = targetRaise / 100;
      let totalTokensBought = 0;

      for (let i = 0; i < 100; i++) {
        const progress = i / 100;
        const currentTknWeight =
          perpConfig.tknWeightIn +
          (perpConfig.tknWeightOut - perpConfig.tknWeightIn) * progress;
        const currentUsdcWeight =
          perpConfig.usdcWeightIn +
          (perpConfig.usdcWeightOut - perpConfig.usdcWeightIn) * progress;

        const amountOut = calculateOutGivenIn(
          usdcBalance,
          currentUsdcWeight,
          tknBalance,
          currentTknWeight,
          buyPerStep,
        );

        usdcBalance += buyPerStep;
        tknBalance -= amountOut;
        totalTokensBought += amountOut;
      }

      const avgPrice = targetRaise / totalTokensBought;

      // Average price should be reasonable (historically was ~$0.24)
      expect(avgPrice).toBeGreaterThan(0.1);
      expect(avgPrice).toBeLessThan(0.5);
      console.log(
        "  → totalTokensBought:",
        totalTokensBought.toFixed(0),
        "avgPrice:",
        avgPrice.toFixed(4),
      );
    });
  });

  describe("APWine LBP (March 2021)", () => {
    // APWine LBP: published params 3.5M APW + 800k USDC, weights 90/10 → 40/60
    const apwineConfig: LBPConfig = {
      tokenName: "APWine",
      tokenSymbol: "APW",
      totalSupply: 50000000,
      percentForSale: 10,
      collateralToken: "USDC",
      tknBalanceIn: 3_500_000,
      tknWeightIn: 90,
      usdcBalanceIn: 800_000,
      usdcWeightIn: 10,
      tknWeightOut: 40,
      usdcWeightOut: 60,
      startDelay: 0,
      duration: 48,
      swapFee: 0.01,
      creatorFee: 0,
    };

    it("should maintain reasonable price trajectory", () => {
      const prices: number[] = [];
      const steps = 10;

      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const currentTknWeight =
          apwineConfig.tknWeightIn +
          (apwineConfig.tknWeightOut - apwineConfig.tknWeightIn) * progress;
        const currentUsdcWeight =
          apwineConfig.usdcWeightIn +
          (apwineConfig.usdcWeightOut - apwineConfig.usdcWeightIn) * progress;

        const price = calculateSpotPrice(
          apwineConfig.usdcBalanceIn,
          currentUsdcWeight,
          apwineConfig.tknBalanceIn,
          currentTknWeight,
        );

        prices.push(price);
      }

      // APWine token weight decreases (90→40), so prices decrease over time
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }

      // Price should decrease by a factor related to weight change
      const priceDecreaseFactor = prices[prices.length - 1] / prices[0];
      expect(priceDecreaseFactor).toBeGreaterThan(0.05);
      expect(priceDecreaseFactor).toBeLessThan(0.6);
      console.log(
        "  → APWine price[0]:",
        prices[0].toFixed(6),
        "price[last]:",
        prices[prices.length - 1].toFixed(6),
        "decreaseFactor:",
        priceDecreaseFactor.toFixed(4),
      );
    });
  });

  describe("Generic LBP Validation Rules", () => {
    it("typical LBP with decreasing token weight has price decreasing", () => {
      const config: LBPConfig = {
        tokenName: "Generic",
        tokenSymbol: "GEN",
        totalSupply: 100000000,
        percentForSale: 10,
        collateralToken: "USDC",
        tknBalanceIn: 10000000,
        tknWeightIn: 92,
        usdcBalanceIn: 1000000,
        usdcWeightIn: 8,
        tknWeightOut: 50,
        usdcWeightOut: 50,
        startDelay: 0,
        duration: 48,
        swapFee: 0.01,
        creatorFee: 5,
      };

      const startPrice = calculateSpotPrice(
        config.usdcBalanceIn,
        config.usdcWeightIn,
        config.tknBalanceIn,
        config.tknWeightIn,
      );

      const endPrice = calculateSpotPrice(
        config.usdcBalanceIn,
        config.usdcWeightOut,
        config.tknBalanceIn,
        config.tknWeightOut,
      );

      // Token weight decreases (92→50), so spot price decreases
      expect(startPrice).toBeGreaterThan(endPrice);

      // Initial TVL should match the input
      const { tvlUsd: startTVL } = calcTVLUSD(config);
      console.log(
        "  → Generic startPrice:",
        startPrice.toFixed(4),
        "endPrice:",
        endPrice.toFixed(4),
        "startTVL:",
        startTVL.toFixed(0),
      );
      expect(startTVL).toBeCloseTo(
        config.usdcBalanceIn + config.tknBalanceIn * startPrice,
        -2,
      );
    });

    it("LBP with 50/50 final weights should have balanced final state", () => {
      const config: LBPConfig = {
        tokenName: "Balanced",
        tokenSymbol: "BAL",
        totalSupply: 100000000,
        percentForSale: 10,
        collateralToken: "USDC",
        tknBalanceIn: 10000000,
        tknWeightIn: 90,
        usdcBalanceIn: 500000,
        usdcWeightIn: 10,
        tknWeightOut: 50,
        usdcWeightOut: 50,
        startDelay: 0,
        duration: 72,
        swapFee: 0.01,
        creatorFee: 5,
      };

      // At 50/50 weights with no trades, the ratio should be balanced
      const finalPrice = calculateSpotPrice(
        config.usdcBalanceIn,
        config.usdcWeightOut,
        config.tknBalanceIn,
        config.tknWeightOut,
      );

      // Price = (BalanceUSDC / WeightUSDC) / (BalanceTKN / WeightTKN)
      // At 50/50: Price = BalanceUSDC / BalanceTKN
      const expectedPrice = config.usdcBalanceIn / config.tknBalanceIn;
      expect(finalPrice).toBeCloseTo(expectedPrice, 6);
      console.log(
        "  → 50/50 finalPrice:",
        finalPrice.toFixed(6),
        "expectedPrice:",
        expectedPrice.toFixed(6),
      );
    });

    it("slippage should increase with trade size", () => {
      const config: LBPConfig = {
        tokenName: "Slippage Test",
        tokenSymbol: "SLIP",
        totalSupply: 100000000,
        percentForSale: 10,
        collateralToken: "USDC",
        tknBalanceIn: 10000000,
        tknWeightIn: 80,
        usdcBalanceIn: 1000000,
        usdcWeightIn: 20,
        tknWeightOut: 50,
        usdcWeightOut: 50,
        startDelay: 0,
        duration: 48,
        swapFee: 0.01,
        creatorFee: 5,
      };

      const spotPrice = calculateSpotPrice(
        config.usdcBalanceIn,
        config.usdcWeightIn,
        config.tknBalanceIn,
        config.tknWeightIn,
      );

      const smallTrade = 1000; // 0.1% of pool
      const mediumTrade = 10000; // 1% of pool
      const largeTrade = 100000; // 10% of pool

      const smallOut = calculateOutGivenIn(
        config.usdcBalanceIn,
        config.usdcWeightIn,
        config.tknBalanceIn,
        config.tknWeightIn,
        smallTrade,
      );

      const mediumOut = calculateOutGivenIn(
        config.usdcBalanceIn,
        config.usdcWeightIn,
        config.tknBalanceIn,
        config.tknWeightIn,
        mediumTrade,
      );

      const largeOut = calculateOutGivenIn(
        config.usdcBalanceIn,
        config.usdcWeightIn,
        config.tknBalanceIn,
        config.tknWeightIn,
        largeTrade,
      );

      const smallSlippage =
        Math.abs(smallTrade / smallOut - spotPrice) / spotPrice;
      const mediumSlippage =
        Math.abs(mediumTrade / mediumOut - spotPrice) / spotPrice;
      const largeSlippage =
        Math.abs(largeTrade / largeOut - spotPrice) / spotPrice;

      // Larger trades should have more slippage
      expect(mediumSlippage).toBeGreaterThan(smallSlippage);
      expect(largeSlippage).toBeGreaterThan(mediumSlippage);
      console.log(
        "  → spotPrice:",
        spotPrice.toFixed(6),
        "smallSlippage:",
        (smallSlippage * 100).toFixed(4) + "%",
        "medium:",
        (mediumSlippage * 100).toFixed(4) + "%",
        "large:",
        (largeSlippage * 100).toFixed(4) + "%",
      );
    });
  });

  describe("Price Impact Validation", () => {
    it("buying should increase price, selling should decrease", () => {
      const usdcBalance = 1000000;
      const usdcWeight = 20;
      const tknBalance = 10000000;
      const tknWeight = 80;

      const priceBefore = calculateSpotPrice(
        usdcBalance,
        usdcWeight,
        tknBalance,
        tknWeight,
      );

      // Buy tokens
      const buyAmount = 50000;
      const tokensReceived = calculateOutGivenIn(
        usdcBalance,
        usdcWeight,
        tknBalance,
        tknWeight,
        buyAmount,
      );

      const priceAfterBuy = calculateSpotPrice(
        usdcBalance + buyAmount,
        usdcWeight,
        tknBalance - tokensReceived,
        tknWeight,
      );

      expect(priceAfterBuy).toBeGreaterThan(priceBefore);
      console.log(
        "  → priceBefore:",
        priceBefore.toFixed(6),
        "priceAfterBuy:",
        priceAfterBuy.toFixed(6),
      );

      // Sell tokens (reverse direction)
      const sellAmount = tokensReceived / 2;
      const usdcReceived = calculateOutGivenIn(
        tknBalance - tokensReceived,
        tknWeight,
        usdcBalance + buyAmount,
        usdcWeight,
        sellAmount,
      );

      const priceAfterSell = calculateSpotPrice(
        usdcBalance + buyAmount - usdcReceived,
        usdcWeight,
        tknBalance - tokensReceived + sellAmount,
        tknWeight,
      );

      expect(priceAfterSell).toBeLessThan(priceAfterBuy);
      console.log("  → priceAfterSell:", priceAfterSell.toFixed(6));
    });
  });

  describe("TVL Sanity Checks", () => {
    it("TVL should increase with successful fundraising", () => {
      const config: LBPConfig = {
        tokenName: "TVL Test",
        tokenSymbol: "TVL",
        totalSupply: 100000000,
        percentForSale: 10,
        collateralToken: "USDC",
        tknBalanceIn: 10000000,
        tknWeightIn: 85,
        usdcBalanceIn: 500000,
        usdcWeightIn: 15,
        tknWeightOut: 50,
        usdcWeightOut: 50,
        startDelay: 0,
        duration: 48,
        swapFee: 0.01,
        creatorFee: 5,
      };

      const { tvlUsd: initialTVL } = calcTVLUSD(config);

      // Simulate raising $1M
      let tknBalance = config.tknBalanceIn;
      let usdcBalance = config.usdcBalanceIn;
      const raiseAmount = 1000000;

      // Buy in chunks
      for (let i = 0; i < 10; i++) {
        const amountOut = calculateOutGivenIn(
          usdcBalance,
          config.usdcWeightIn,
          tknBalance,
          config.tknWeightIn,
          raiseAmount / 10,
        );

        usdcBalance += raiseAmount / 10;
        tknBalance -= amountOut;
      }

      const { tvlUsd: finalTVL } = calcTVLUSD(
        config,
        tknBalance,
        usdcBalance,
        config.tknWeightIn,
        config.usdcWeightIn,
      );

      // TVL should have increased significantly
      expect(finalTVL).toBeGreaterThan(initialTVL);
      // Should be roughly initial + raised amount (plus price appreciation)
      expect(finalTVL).toBeGreaterThan(initialTVL + raiseAmount * 0.8);
      console.log(
        "  → initialTVL:",
        initialTVL.toFixed(0),
        "finalTVL:",
        finalTVL.toFixed(0),
        "raiseAmount:",
        raiseAmount,
      );
    });
  });
});
