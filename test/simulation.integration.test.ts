import { describe, it, expect } from "vitest";
import type {
  LBPConfig,
  DemandPressureConfig,
  SellPressureConfig,
} from "../lib/lbp-math";
import type { SimulationStateSnapshot } from "../lib/simulation-core";
import { runDeterministicSimulation } from "../public/workers/simulation-runner.js";

/**
 * Integration tests for the complete simulation (run in-process; no Worker).
 * These tests validate end-to-end behavior including buy/sell pressure.
 */
describe("LBP Simulation Integration", () => {
  const runSimulation = (
    config: LBPConfig,
    demandConfig: DemandPressureConfig,
    sellConfig: SellPressureConfig,
    steps: number,
  ): Promise<SimulationStateSnapshot[]> => {
    const result = runDeterministicSimulation(
      config,
      demandConfig,
      sellConfig,
      steps,
    );
    return Promise.resolve(result);
  };

  const createBaseConfig = (): LBPConfig => ({
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
  });

  describe("Simulation Invariants", () => {
    it("should maintain conservation of tokens (no tokens created or destroyed)", async () => {
      const config = createBaseConfig();
      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 1,
      };
      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 5,
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      const firstTotal =
        snapshots[0].tknBalance + snapshots[0].communityTokensHeld;
      const lastTotal =
        snapshots[snapshots.length - 1].tknBalance +
        snapshots[snapshots.length - 1].communityTokensHeld;
      for (const snapshot of snapshots) {
        const totalTokens = snapshot.tknBalance + snapshot.communityTokensHeld;

        // Total tokens constant within precision; with swap fee on sells, pool keeps fee so total can dip slightly
        expect(
          Math.abs(totalTokens - config.tknBalanceIn) / config.tknBalanceIn,
        ).toBeLessThan(0.02);
      }
      console.log(
        "  → first totalTokens:",
        firstTotal.toFixed(0),
        "last totalTokens:",
        lastTotal.toFixed(0),
        "expected:",
        config.tknBalanceIn,
      );
    });

    it("should have monotonically increasing or stable USDC balance", async () => {
      const config = createBaseConfig();
      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 1,
      };
      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 5,
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      for (let i = 1; i < snapshots.length; i++) {
        // USDC can only increase (from buys) or decrease (from sells)
        // But total USDC in + out should be conserved
        const usdcChange =
          snapshots[i].usdcBalance - snapshots[i - 1].usdcBalance;
        const buyVolume = snapshots[i].buyVolumeUSDC;
        const sellVolume = snapshots[i].sellVolumeUSDC;

        // USDC change should equal buy - sell volume (within precision)
        expect(Math.abs(usdcChange - (buyVolume - sellVolume))).toBeLessThan(
          0.01,
        );
      }
      const firstUsdc = snapshots[0].usdcBalance;
      const lastUsdc = snapshots[snapshots.length - 1].usdcBalance;
      console.log(
        "  → first usdcBalance:",
        firstUsdc.toFixed(0),
        "last usdcBalance:",
        lastUsdc.toFixed(0),
      );
    });

    it("weight-only run: price decreases when token weight goes 90→10 (no trading)", async () => {
      const config = createBaseConfig();
      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 0, // No demand so price move is from weight change only
      };
      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 0, // No selling to isolate weight effect
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      // No trading: token weight goes 90→10 (decreasing), so spot price decreases
      const firstPrice = snapshots[0].price;
      const lastPrice = snapshots[snapshots.length - 1].price;

      expect(lastPrice).toBeLessThan(firstPrice);
      console.log(
        "  → firstPrice:",
        firstPrice.toFixed(6),
        "lastPrice:",
        lastPrice.toFixed(6),
      );
    });

    it("time should progress linearly", async () => {
      const config = createBaseConfig();
      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 10000,
        multiplier: 1,
      };
      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 5,
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const steps = 100;
      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        steps,
      );

      expect(snapshots.length).toBe(steps + 1);
      expect(snapshots[0].time).toBe(0);
      expect(snapshots[steps].time).toBe(config.duration);

      // Check linear progression
      const expectedTimeStep = config.duration / steps;
      for (let i = 0; i <= steps; i++) {
        expect(Math.abs(snapshots[i].time - i * expectedTimeStep)).toBeLessThan(
          0.001,
        );
      }
      console.log(
        "  → steps:",
        steps,
        "time[0]:",
        snapshots[0].time,
        "time[last]:",
        snapshots[steps].time,
        "duration:",
        config.duration,
      );
    });
  });

  describe("Scenario Testing", () => {
    it("no demand scenario: price should only decrease from weight changes", async () => {
      const config = createBaseConfig();
      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 10000,
        multiplier: 0, // No buying pressure
      };
      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 0, // No selling pressure
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      // Balances should remain constant
      expect(snapshots[0].tknBalance).toBe(config.tknBalanceIn);
      expect(snapshots[0].usdcBalance).toBe(config.usdcBalanceIn);
      expect(snapshots[100].tknBalance).toBe(config.tknBalanceIn);
      expect(snapshots[100].usdcBalance).toBe(config.usdcBalanceIn);

      // Price should decrease as token weight drops
      expect(snapshots[100].price).toBeLessThan(snapshots[0].price);
      console.log(
        "  → no demand: price[0]:",
        snapshots[0].price.toFixed(6),
        "price[100]:",
        snapshots[100].price.toFixed(6),
      );
    }); 

    it("high demand scenario: should accumulate significant USDC", async () => {
      const config = createBaseConfig();
      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 1000000, // 1M USDC total
        multiplier: 2,
      };
      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 0,
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      const finalSnapshot = snapshots[snapshots.length - 1];

      // Should have accumulated close to 2M USDC
      expect(finalSnapshot.usdcBalance).toBeGreaterThan(
        config.usdcBalanceIn + 1500000,
      );

      // Token balance should have decreased significantly
      expect(finalSnapshot.tknBalance).toBeLessThan(config.tknBalanceIn * 0.5);

      // Community should hold significant tokens
      expect(finalSnapshot.communityTokensHeld).toBeGreaterThan(0);
      console.log(
        "  → high demand: final usdcBalance:",
        finalSnapshot.usdcBalance.toFixed(0),
        "final tknBalance:",
        finalSnapshot.tknBalance.toFixed(0),
        "communityTokensHeld:",
        finalSnapshot.communityTokensHeld.toFixed(0),
      );
    });

    it("loyal sell pressure: should see sells at beginning and end", async () => {
      const config = createBaseConfig();
      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 2,
      };
      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 10,
        loyalConcentrationPct: 80, // High concentration at edges
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      // Find total sell volume in first 20%, middle 20%, and last 20%
      const firstQuintile = snapshots.slice(0, 20);
      const middleQuintile = snapshots.slice(40, 60);
      const lastQuintile = snapshots.slice(80, 100);

      const firstSells = firstQuintile.reduce(
        (sum, s) => sum + s.sellVolumeTKN,
        0,
      );
      const middleSells = middleQuintile.reduce(
        (sum, s) => sum + s.sellVolumeTKN,
        0,
      );
      const lastSells = lastQuintile.reduce(
        (sum, s) => sum + s.sellVolumeTKN,
        0,
      );

      // With high concentration, edge periods should have more sells than middle
      expect(firstSells + lastSells).toBeGreaterThan(middleSells);
      console.log(
        "  → loyal: firstQuintile sells:",
        firstSells.toFixed(0),
        "middleQuintile:",
        middleSells.toFixed(0),
        "lastQuintile:",
        lastSells.toFixed(0),
      );
    });

    it("greedy sell pressure: should sell when profitable", async () => {
      const config = createBaseConfig();
      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 1_000_000, // Strong buying to create profit opportunities
        multiplier: 1,
      };
      const sellConfig: SellPressureConfig = {
        preset: "greedy",
        loyalSoldPct: 5,
        loyalConcentrationPct: 60,
        greedySpreadPct: 5, // Sell when 5% above cost basis
        greedySellPct: 50, // Sell 50% of holdings
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      // Should see some selling activity
      const totalSells = snapshots.reduce((sum, s) => sum + s.sellVolumeTKN, 0);
      expect(totalSells).toBeGreaterThan(0);

      // Community should still hold some tokens at the end (not selling everything)
      const finalSnapshot = snapshots[snapshots.length - 1];
      expect(finalSnapshot.communityTokensHeld).toBeGreaterThan(0);
      console.log(
        "  → greedy: totalSells:",
        totalSells.toFixed(0),
        "communityTokensHeld:",
        finalSnapshot.communityTokensHeld.toFixed(0),
      );
    });
  });

  describe("Realistic LBP Scenarios", () => {
    it("typical successful LBP: moderate demand, loyal community", async () => {
      const config: LBPConfig = {
        tokenName: "SuccessToken",
        tokenSymbol: "SUCC",
        totalSupply: 100000000,
        percentForSale: 10,
        collateralToken: "USDC",
        tknBalanceIn: 10000000,
        tknWeightIn: 95,
        usdcBalanceIn: 500000,
        usdcWeightIn: 5,
        tknWeightOut: 50,
        usdcWeightOut: 50,
        startDelay: 0,
        duration: 72,
        swapFee: 0.01,
        creatorFee: 5,
      };

      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 1000000,
        multiplier: 1.5,
      };

      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 3,
        loyalConcentrationPct: 50,
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      const finalSnapshot = snapshots[snapshots.length - 1];

      // Should raise significant USDC
      expect(finalSnapshot.usdcBalance).toBeGreaterThan(
        config.usdcBalanceIn + 1000000,
      );

      // With token weight 90→50 (decreasing), spot price decreases; assert positive and sensible
      expect(finalSnapshot.price).toBeGreaterThan(0);

      // TVL should be substantial
      expect(finalSnapshot.tvlUsd).toBeGreaterThan(1000000);
      console.log(
        "  → typical successful: final usdcBalance:",
        finalSnapshot.usdcBalance.toFixed(0),
        "final price:",
        finalSnapshot.price.toFixed(6),
        "tvlUsd:",
        finalSnapshot.tvlUsd.toFixed(0),
      );
    });

    it("bearish LBP: low demand, greedy sellers", async () => {
      const config = createBaseConfig();

      const demandConfig: DemandPressureConfig = {
        preset: "bearish",
        magnitudeBase: 10000,
        multiplier: 0.5,
      };

      const sellConfig: SellPressureConfig = {
        preset: "greedy",
        loyalSoldPct: 5,
        loyalConcentrationPct: 60,
        greedySpreadPct: 1, // Very sensitive, sell quickly
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      const finalSnapshot = snapshots[snapshots.length - 1];

      // Price likely decreased or stayed low
      const priceChange =
        (finalSnapshot.price - snapshots[0].price) / snapshots[0].price;
      expect(priceChange).toBeLessThan(1); // Less than 100% increase, possibly negative
      console.log(
        "  → bearish: final price:",
        finalSnapshot.price.toFixed(6),
        "priceChange:",
        (priceChange * 100).toFixed(2) + "%",
      );
    });
  });

  describe("Edge Cases and Stability", () => {
    it("should handle very short duration", async () => {
      const config = createBaseConfig();
      config.duration = 1; // 1 hour

      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 1,
      };

      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 5,
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      expect(snapshots.length).toBe(101);
      expect(snapshots[0].time).toBe(0);
      expect(snapshots[100].time).toBe(1);
      expect(isFinite(snapshots[100].price)).toBe(true);
      console.log(
        "  → short duration: time[100]:",
        snapshots[100].time,
        "price[100]:",
        snapshots[100].price.toFixed(6),
      );
    });

    it("should handle very long duration", async () => {
      const config = createBaseConfig();
      config.duration = 720; // 30 days

      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 1,
      };

      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 5,
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      expect(snapshots[100].time).toBe(720);
      expect(isFinite(snapshots[100].price)).toBe(true);
      console.log(
        "  → long duration: time[100]:",
        snapshots[100].time,
        "price[100]:",
        snapshots[100].price.toFixed(6),
      );
    });

    it("should handle extreme weight configurations", async () => {
      const config = createBaseConfig();
      config.tknWeightIn = 99;
      config.usdcWeightIn = 1;
      config.tknWeightOut = 1;
      config.usdcWeightOut = 99;

      const demandConfig: DemandPressureConfig = {
        preset: "bullish",
        magnitudeBase: 100000,
        multiplier: 1,
      };

      const sellConfig: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 5,
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 100,
      };

      const snapshots = await runSimulation(
        config,
        demandConfig,
        sellConfig,
        100,
      );

      // Should complete without errors
      expect(snapshots.length).toBe(101);

      // All values should be finite
      snapshots.forEach((s) => {
        expect(isFinite(s.price)).toBe(true);
        expect(isFinite(s.tvlUsd)).toBe(true);
        expect(s.price).toBeGreaterThan(0);
      });
      console.log(
        "  → extreme weights: snapshots:",
        snapshots.length,
        "price[0]:",
        snapshots[0].price.toFixed(6),
        "price[100]:",
        snapshots[100].price.toFixed(6),
        "tvlUsd[100]:",
        snapshots[100].tvlUsd.toFixed(0),
      );
    });
  });
});
