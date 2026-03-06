import fs from "node:fs";
import path from "node:path";

import { runDeterministicSimulation } from "../public/workers/simulation-runner.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a || !a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function formatNumber(n, maxFrac = 4) {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return n.toFixed(maxFrac);
}

function normalizeWeights(cfg) {
  const next = { ...cfg };

  if (typeof next.tknWeightIn === "number" && typeof next.usdcWeightIn !== "number") {
    next.usdcWeightIn = 100 - next.tknWeightIn;
  }
  if (typeof next.usdcWeightIn === "number" && typeof next.tknWeightIn !== "number") {
    next.tknWeightIn = 100 - next.usdcWeightIn;
  }

  if (typeof next.tknWeightOut === "number" && typeof next.usdcWeightOut !== "number") {
    next.usdcWeightOut = 100 - next.tknWeightOut;
  }
  if (typeof next.usdcWeightOut === "number" && typeof next.tknWeightOut !== "number") {
    next.tknWeightOut = 100 - next.usdcWeightOut;
  }

  return next;
}

function maybeWarnTknBalanceMismatch(cfg) {
  if (!Number.isFinite(cfg.totalSupply) || !Number.isFinite(cfg.percentForSale)) return;
  const expected = cfg.totalSupply * (cfg.percentForSale / 100);
  if (!Number.isFinite(cfg.tknBalanceIn) || expected === 0) return;
  const rel = Math.abs(cfg.tknBalanceIn - expected) / expected;
  if (rel > 0.01) {
    console.warn(
      `[warn] tknBalanceIn (${cfg.tknBalanceIn}) != totalSupply*percentForSale (${expected}). ` +
        `UI behavior assumes equality.`,
    );
  }
}

function mergeCase(base, overrides) {
  const steps = overrides?.steps ?? base.steps ?? 300;
  const lbpConfig = normalizeWeights({
    ...base.lbpConfig,
    ...(overrides?.lbpConfig ?? {}),
  });
  const demandConfig = { ...base.demandConfig, ...(overrides?.demandConfig ?? {}) };
  const sellConfig = { ...base.sellConfig, ...(overrides?.sellConfig ?? {}) };

  maybeWarnTknBalanceMismatch(lbpConfig);

  return { steps, lbpConfig, demandConfig, sellConfig };
}

function summarizeRun(label, cfg, snapshots) {
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = 0;
  let totalBuys = 0;
  let totalSells = 0;

  for (const s of snapshots) {
    if (Number.isFinite(s.price)) {
      minPrice = Math.min(minPrice, s.price);
      maxPrice = Math.max(maxPrice, s.price);
    }
    totalBuys += s.buyVolumeUSDC ?? 0;
    totalSells += s.sellVolumeUSDC ?? 0;
  }

  const netRaised = totalBuys - totalSells;

  return {
    label,
    collateral: cfg.collateralToken,
    durationH: cfg.duration,
    swapFeePct: cfg.swapFee,
    startWeight: `${cfg.tknWeightIn}/${cfg.usdcWeightIn}`,
    endWeight: `${cfg.tknWeightOut}/${cfg.usdcWeightOut}`,
    initialPrice: first?.price ?? 0,
    finalPrice: last?.price ?? 0,
    minPrice,
    maxPrice,
    totalBuys,
    totalSells,
    netRaised,
    finalCollateral: last?.usdcBalance ?? 0,
    finalPoolTokens: last?.tknBalance ?? 0,
    communityHeld: last?.communityTokensHeld ?? 0,
    communityAvgCost: last?.communityAvgCost ?? 0,
    finalTVL: last?.tvlUsd ?? 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileArg = args.file;
  const caseId = typeof args.case === "string" ? args.case : undefined;
  const jsonOut = Boolean(args.json);

  if (typeof fileArg !== "string" || fileArg.trim().length === 0) {
    const scenariosDir = path.resolve(process.cwd(), "scenarios");
    const files = fs.existsSync(scenariosDir)
      ? fs.readdirSync(scenariosDir).filter((f) => f.endsWith(".json")).sort()
      : [];
    console.error(
      `Missing --file.\n\nAvailable scenario files:\n` +
        (files.length ? files.map((f) => `- scenarios/${f}`).join("\n") : "(none)"),
    );
    process.exitCode = 1;
    return;
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const raw = fs.readFileSync(filePath, "utf8");
  const scenario = JSON.parse(raw);

  const cases = scenario.cases?.length
    ? scenario.cases
    : [{ id: "base", label: "Base", overrides: {} }];

  const selected = caseId ? cases.filter((c) => c.id === caseId) : cases;
  if (caseId && selected.length === 0) {
    console.error(
      `Case not found: ${caseId}\nAvailable cases:\n` +
        cases.map((c) => `- ${c.id}${c.label ? ` (${c.label})` : ""}`).join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  const summaries = [];
  for (const c of selected) {
    const { steps, lbpConfig, demandConfig, sellConfig } = mergeCase(
      scenario.base,
      c.overrides,
    );

    const snapshots = runDeterministicSimulation(
      lbpConfig,
      demandConfig,
      sellConfig,
      steps,
    );

    const label = c.label ? `${c.id}: ${c.label}` : c.id;
    summaries.push(summarizeRun(label, lbpConfig, snapshots));
  }

  if (jsonOut) {
    console.log(JSON.stringify({ file: fileArg, case: caseId ?? null, summaries }, null, 2));
    return;
  }

  console.log(`Scenario: ${path.basename(filePath)}`);
  console.table(
    summaries.map((s) => ({
      case: s.label,
      collateral: s.collateral,
      durationH: s.durationH,
      feePct: s.swapFeePct,
      weights: `${s.startWeight}→${s.endWeight}`,
      raisedNet: formatNumber(s.netRaised, 2),
      buys: formatNumber(s.totalBuys, 2),
      sells: formatNumber(s.totalSells, 2),
      price0: formatNumber(s.initialPrice, 8),
      priceMin: formatNumber(s.minPrice, 8),
      priceEnd: formatNumber(s.finalPrice, 8),
      commHeld: formatNumber(s.communityHeld, 2),
      commAvgCost: formatNumber(s.communityAvgCost, 8)
    })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

