# LBP Simulation Math

This document explains the mathematics behind the LBP (Liquidity Bootstrapping Pool) simulation. The implementation lives in `lbp-math.ts` and `public/workers/simulation-runner.js`.

---

## 1. Balancer AMM basics

Balancer uses a **constant-value product** AMM. The invariant is:

$$
V = B_{\text{in}}^{w_{\text{in}}} \cdot B_{\text{out}}^{w_{\text{out}}}
$$

Where $B$ = balance and $w$ = weight (as a fraction 0–1). For LBPs, weights change over time to drive price discovery.

---

## 2. Spot price

The spot price (collateral per token) is:

$$
P = \frac{B_{\text{USDC}} / w_{\text{USDC}}}{B_{\text{TKN}} / w_{\text{TKN}}}
$$

In code:

```ts
price = usdcBalance / usdcWeight / (tknBalance / tknWeight);
```

If collateral weight is low and token weight is high, the token is cheap. As weights shift (e.g. 96/4 → 25/75), price rises. Hence **price ∝ 1 / token_weight** when balances are fixed.

---

## 3. Swap: Out given in

When swapping collateral for token, the amount of token received is:

$$
A_{\text{out}} = B_{\text{out}} \cdot \left(1 - \left(\frac{B_{\text{in}}}{B_{\text{in}} + A_{\text{in}}^{\text{eff}}}\right)^{w_{\text{in}}/w_{\text{out}}}\right)
$$

$A_{\text{in}}^{\text{eff}}$ is the amount after swap fee: `amountIn * (1 - swapFee)`.

In code:

```ts
weightRatio = weightIn / weightOut;
base = balanceIn / (balanceIn + effectiveIn);
amountOut = balanceOut * (1 - Math.pow(base, weightRatio));
```

This preserves the value function; the fee only affects effective price impact.

---

## 4. Weight schedule

Weights evolve linearly over the sale duration:

$$
w_{\text{TKN}}(t) = w_{\text{in}} + (w_{\text{out}} - w_{\text{in}}) \cdot \text{progress}
$$

$$
w_{\text{USDC}}(t) = 1 - w_{\text{TKN}}(t)
$$

Where `progress = step / totalSteps` (0 → 1). Typical LBP: token weight starts high (e.g. 96) and ends low (e.g. 25), so price increases over time from weight shift alone.

---

## 5. Buy pressure (demand)

Buy pressure is modeled as **cumulative USDC volume** over time. We convert it to per-step flow with discrete differences.

### 5.1 Cumulative curve

Total USDC at the end:

$$
\text{endTotal} = \text{magnitudeBase} \times \text{multiplier} \times \text{endScale}
$$

- `magnitudeBase`: 10k, 100k, or 1M
- `endScale`: 1.0 for bullish, 0.35 for bearish (bearish = lighter buying)

Per-step normalized progress (0 → 1):

| Preset  | Formula                 | Shape                  |
| ------- | ----------------------- | ---------------------- |
| Bullish | $\text{progress}^{0.9}$ | Concave, steady buying |
| Bearish | $\text{progress}^{1.8}$ | Convex, ramps later    |

Cumulative at step $i$:

$$
C_i = \text{endTotal} \times \text{normalized}(\text{progress}_i)
$$

Curve is forced monotone and exact at endpoints: $C_0 = 0$, $C_N = \text{endTotal}$.

### 5.2 Per-step flow

$$
\text{flow}_i = \max(0, C_i - C_{i-1})
$$

This is the USDC spent by "community" buyers in that step.

---

## 6. Sell pressure

### 6.1 Loyal preset

Community sells according to a schedule that concentrates at **start and end** of the sale (Gaussian bumps).

**Schedule weights** (sum to 1):

$$
\sigma = \sigma_{\max} + (\sigma_{\min} - \sigma_{\max}) \cdot a
$$

$$
\text{bump}(x) = e^{-0.5 (x/\sigma)^2} + e^{-0.5 ((1-x)/\sigma)^2}
$$

$$
w_i = \frac{1 + a \cdot \text{bump}(x_i)}{\sum_j (1 + a \cdot \text{bump}(x_j))}
$$

- `a` = `concentrationPct / 100` (0–1)
- Higher `a` → sharper concentration at edges

**Target tokens to sell** over the campaign:

$$
\text{totalTarget} = B_{\text{TKN,in}} \times \frac{\text{loyalSoldPct}}{100}
$$

**Per-step target**: `totalTarget × weight_i`

**Sell amount** at step $i$:

$$
\text{sellFraction} = \min(0.1, \max(0.001, w_i \times 100))
$$

$$
\text{amountToken} = \min(\text{communityHeld} \times \text{sellFraction}, \text{stepTarget} \times 5)
$$

So selling is front- and back-loaded when `concentrationPct` is high.

### 6.2 Greedy preset

Community sells when profitable or when holdings are large.

**Profit threshold**:

$$
\text{threshold} = \text{communityAvgCost} \times (1 + \text{greedySpreadPct}/100)
$$

If `price >= threshold` → sell `greedySellPct`% of holdings.

**Fallback**: if `communityHeld > 2%` of initial token balance, sell up to 5% per step continuously (simulates takers in declining markets).

---

## 7. Community state

**Average cost** (when buying):

$$
\text{avgCost}_{\text{new}} = \frac{\text{avgCost} \times \text{held} + \text{pricePaid} \times \text{amountOut}}{\text{held} + \text{amountOut}}
$$

Where `pricePaid = flowUSDC / amountOut`.

**Community tokens held** increases on buys and decreases on sells. When holdings go to 0, `avgCost` resets to 0.

---

## 8. Simulation flow (per step)

For each step $i$:

1. **Interpolate weights** using linear schedule.
2. **Buy pressure**: Apply `flowUSDC` from demand curve.
   - Use `calculateOutGivenIn` with USDC in, token out.
   - Update balances, community tokens, and `communityAvgCost`.
3. **Compute price** after buys.
4. **Sell pressure** (loyal or greedy):
   - Compute `amountToken` to sell.
   - Use `calculateOutGivenIn` with token in, USDC out.
   - Update balances and community state.
5. **Record snapshot**: price, balances, weights, TVL, volumes.

---

## 9. Price paths (scenarios)

`calculatePotentialPricePaths` runs multiple scenarios from a given step/state. Each scenario applies a **multiplier** to the remaining buy flow:

$$
\text{flow}_{\text{eff}} = \text{flow}_{\text{base}} \times \text{effectiveFactor}
$$

Where `effectiveFactor` transitions from 1 to the scenario multiplier over the remaining steps. Scenarios like `[0, 0.8, 1.5]` yield low/medium/high demand paths.

---

## 10. Swap fee convention

- Fee is applied to **price impact** only: `effectiveIn = amountIn * (1 - swapFee)`.
- The pool still receives the full `amountIn`; the fee is external to our model.

---

## 11. Demand curve (fair value)

`getDemandCurve` returns a "fair value" price curve based purely on weight shift (no trades):

$$
w(t) = w_{\text{initial}} - (w_{\text{initial}} - w_{\text{final}}) \cdot \text{progress}
$$

$$
P_{\text{fair}}(t) = P_0 \times \frac{w(t)}{w_{\text{initial}}}
$$

With constant balances, price scales linearly with token weight. Used for reference charts.
