# LBP Simulator

A web app for simulating [Liquidity Bootstrapping Pools](https://docs.balancer.fi/concepts/explore-available-balancer-pools/liquidity-bootstrapping-pool.html) (LBP) from Balancer. Helps teams model fair token launches and on-chain price discovery.

## What's inside

- **Landing page** (`/`) — Hero, use cases, KPIs, FAQs, and links to the simulator
- **Simulator** (`/lbp-simulator`) — Interactive LBP sale simulation with configurable parameters, charts, and swap forms

## Tech stack

- **Next.js 16** (App Router)
- **React 19**
- **Zustand** — state management
- **Tailwind CSS** — styling
- **shadcn/ui** — UI components
- **Recharts** — charts
- **Anime.js** — animations
- **Three.js** — 3D background

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The landing page is at `/`, the simulator at `/lbp-simulator`.

## Scripts

| Command                    | Description                    |
| -------------------------- | ------------------------------ |
| `npm run dev`              | Start dev server               |
| `npm run build`            | Production build               |
| `npm run start`            | Start production server        |
| `npm run lint`             | Run ESLint                     |
| `npm run test`             | Run Vitest tests (watch)       |
| `npm run test:run`         | Run tests once (CI)            |
| `npm run test:ui`          | Run Vitest UI                  |
| `npm run validate-quick`   | Quick validation (pre-deploy)  |
| `npm run compare-real-lbp` | Compare simulation vs real LBP |

## Testing

Tests live in `test/` and use [Vitest](https://vitest.dev/).

| File                             | What it covers                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `lbp-math.test.ts`               | Unit tests for LBP formulas (spot price, outGivenIn, value function, demand curves) |
| `real-lbp-validation.test.ts`    | Validation against real LBP parameters (e.g. PERP, MPL)                             |
| `simulation.integration.test.ts` | End-to-end simulation (conservation, snapshots, buy/sell pressure)                  |

**Standalone scripts**

- `validate-quick` — Fast sanity check before deploy (core math invariants)
- `compare-real-lbp` — Compare simulated outcomes vs historical LBP data

## Hooks

| Hook                  | Location     | Purpose                                                                                                                                                    |
| --------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSimulationWorker` | `lib/hooks/` | Runs the full LBP simulation in a Web Worker. Returns `{ snapshots, isLoading, error }`.                                                                   |
| `usePricePathsWorker` | `lib/hooks/` | Computes potential price paths for charts (bullish/bearish scenarios). Returns `{ paths, isLoading, error }`.                                              |
| `useDisplayStep`      | `lib/hooks/` | Drives smooth chart reveal during playback. Interpolates between steps via `requestAnimationFrame` so charts animate at 60fps without hammering the store. |
| `useDebounce`         | `lib/`       | Debounces a value (default 500ms).                                                                                                                         |
| `useThrottle`         | `lib/`       | Throttles a value (default 100ms).                                                                                                                         |
| `useIsMobile`         | `hooks/`     | Returns `true` when viewport < 768px.                                                                                                                      |

## Workers

Web Workers in `public/workers/` keep heavy simulation work off the main thread.

| Worker                 | Purpose                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `simulationWorker.js`  | Runs the deterministic LBP simulation (buy/sell pressure, weight shifts). Spawned by `useSimulationWorker`.                |
| `pricePathsWorker.js`  | Calculates price paths for multiple scenarios (e.g. 0%, 50%, 100% demand). Spawned by `usePricePathsWorker`.               |
| `simulation-runner.js` | Shared simulation logic. Used by both workers and by Node tests (`simulation.integration.test.ts`, `compare-real-lbp.ts`). |

## Project structure

```
app/
  page.tsx              # Landing page
  lbp-simulator/        # Simulator route
components/
  layout/               # Landing page sections (Hero, UseCases, etc.)
  lbp-simulator/        # Simulator UI and charts
lib/
  lbp-math.ts           # LBP math formulas
  simulation-core.ts    # Simulation engine
  hooks/                # useSimulationWorker, usePricePathsWorker, useDisplayStep
  useDebounce.ts
  useThrottle.ts
hooks/
  use-mobile.ts         # Responsive breakpoint
public/workers/
  simulationWorker.js   # Worker for full simulation
  pricePathsWorker.js   # Worker for price path scenarios
  simulation-runner.js  # Shared logic (workers + tests)
store/
  useSimulatorStore.ts  # State store
test/
  lbp-math.test.ts     # LBP math unit tests
  real-lbp-validation.test.ts
  simulation.integration.test.ts
  compare-real-lbp.ts  # Standalone comparison tool
  validade-quick.js    # Quick validation script
```

## License

Private project.
