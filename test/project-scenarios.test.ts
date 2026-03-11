import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";

import type {
  DemandPressureConfig,
  LBPConfig,
  SellPressureConfig,
} from "../lib/lbp-math";
import { runDeterministicSimulation } from "../public/workers/simulation-runner.js";

type ScenarioFile = {
  project?: {
    id?: string;
    name?: string;
    chain?: string;
    registeredWallets?: number;
    notes?: string[];
  };
  base: {
    steps?: number;
    lbpConfig: LBPConfig;
    demandConfig: DemandPressureConfig;
    sellConfig: SellPressureConfig;
  };
  cases?: Array<{
    id: string;
    label?: string;
    overrides?: Partial<{
      steps: number;
      lbpConfig: Partial<LBPConfig>;
      demandConfig: Partial<DemandPressureConfig>;
      sellConfig: Partial<SellPressureConfig>;
    }>;
  }>;
};

function normalizeWeights(cfg: LBPConfig): LBPConfig {
  const next = { ...cfg };
  if (typeof next.tknWeightIn === "number" && typeof next.usdcWeightIn !== "number") {
    next.usdcWeightIn = 100 - next.tknWeightIn;
  }
  if (typeof next.tknWeightOut === "number" && typeof next.usdcWeightOut !== "number") {
    next.usdcWeightOut = 100 - next.tknWeightOut;
  }
  return next;
}

function mergeCase(
  base: ScenarioFile["base"],
  overrides?: NonNullable<ScenarioFile["cases"]>[number]["overrides"],
) {
  const steps = overrides?.steps ?? base.steps ?? 300;
  const lbpConfig = normalizeWeights({
    ...base.lbpConfig,
    ...(overrides?.lbpConfig ?? {}),
  });
  const demandConfig = { ...base.demandConfig, ...(overrides?.demandConfig ?? {}) };
  const sellConfig = { ...base.sellConfig, ...(overrides?.sellConfig ?? {}) };
  return { steps, lbpConfig, demandConfig, sellConfig };
}

function listScenarioFiles() {
  const dir = path.resolve(process.cwd(), "scenarios");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(dir, f));
}

function summarizeSnapshots(snapshots: any[]) {
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

  return {
    initialPrice: first?.price ?? 0,
    finalPrice: last?.price ?? 0,
    minPrice,
    maxPrice,
    totalBuys,
    totalSells,
    netRaised: totalBuys - totalSells,
    finalCollateral: last?.usdcBalance ?? 0,
    finalPoolTokens: last?.tknBalance ?? 0,
    communityHeld: last?.communityTokensHeld ?? 0,
    communityAvgCost: last?.communityAvgCost ?? 0,
    finalTVL: last?.tvlUsd ?? 0,
  };
}

// Estimates "number of swaps" from executed volume by assuming an average trade size in USD.
// NOTE: This is a *derived metric* for reporting/gas intuition. The deterministic price path
// is driven by total net flow per step, not by how that flow is split into individual trades.
//
// Backward-compat: SWAP_EVENT_THRESHOLD_USD applies to both buys and sells.
const SWAP_EVENT_THRESHOLD_USD = Number(process.env.SWAP_EVENT_THRESHOLD_USD ?? NaN);
const AVG_BUY_SWAP_USD = Number(process.env.AVG_BUY_SWAP_USD ?? 250);
const AVG_SELL_SWAP_USD = Number(process.env.AVG_SELL_SWAP_USD ?? 500);

function estimateSwapEvents(
  snapshots: any[],
  collateralToken: LBPConfig["collateralToken"],
  assumedEthUsd: number,
) {
  const collateralUsd =
    collateralToken === "ETH" || collateralToken === "wETH" ? assumedEthUsd : 1;
  const buyDenom =
    Number.isFinite(SWAP_EVENT_THRESHOLD_USD) && SWAP_EVENT_THRESHOLD_USD > 0
      ? SWAP_EVENT_THRESHOLD_USD
      : Number.isFinite(AVG_BUY_SWAP_USD) && AVG_BUY_SWAP_USD > 0
        ? AVG_BUY_SWAP_USD
        : 250;
  const sellDenom =
    Number.isFinite(SWAP_EVENT_THRESHOLD_USD) && SWAP_EVENT_THRESHOLD_USD > 0
      ? SWAP_EVENT_THRESHOLD_USD
      : Number.isFinite(AVG_SELL_SWAP_USD) && AVG_SELL_SWAP_USD > 0
        ? AVG_SELL_SWAP_USD
        : 500;

  let estBuys = 0;
  let estSells = 0;
  let buyCarryUsd = 0;
  let sellCarryUsd = 0;

  for (const s of snapshots) {
    const buyUsd = (s.buyVolumeUSDC ?? 0) * collateralUsd;
    const sellUsd = (s.sellVolumeUSDC ?? 0) * collateralUsd;

    buyCarryUsd += buyUsd;
    const buySwaps = Math.floor(buyCarryUsd / buyDenom);
    if (buySwaps > 0) {
      estBuys += buySwaps;
      buyCarryUsd -= buySwaps * buyDenom;
    }

    sellCarryUsd += sellUsd;
    const sellSwaps = Math.floor(sellCarryUsd / sellDenom);
    if (sellSwaps > 0) {
      estSells += sellSwaps;
      sellCarryUsd -= sellSwaps * sellDenom;
    }
  }

  return { estBuys, estSells, estTotal: estBuys + estSells };
}

function estimateEndCumulativeBuys(config: DemandPressureConfig) {
  const endScale = config.preset === "bearish" ? 0.35 : 1.0;
  return config.magnitudeBase * config.multiplier * endScale;
}

function formatNumber(n: number, maxFrac = 4) {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return n.toFixed(maxFrac);
}

function pickMagnitudeBaseForTarget(targetUnits: number) {
  const bases = [10_000, 100_000, 1_000_000] as const;
  let bestBase: (typeof bases)[number] = 100_000;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const base of bases) {
    const mult = targetUnits / base;
    // Prefer multipliers in a "nice" range.
    const penaltyLow = mult < 0.1 ? 10 + (0.1 - mult) * 50 : 0;
    const penaltyHigh = mult > 20 ? 10 + (mult - 20) : 0;
    const score = penaltyLow + penaltyHigh + Math.abs(Math.log10(Math.max(1e-9, mult)));
    if (score < bestScore) {
      bestScore = score;
      bestBase = base;
    }
  }

  return bestBase;
}

function csvEscape(v: unknown) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsvFile(filePath: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "", "utf8");
    return;
  }

  const headers = Object.keys(rows[0] ?? {});
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape((r as any)[h])).join(","));
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toExcelColumnName(colIndex0: number) {
  let n = colIndex0 + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function buildSheetXml(sheetName: string, headers: string[], rows: Array<Record<string, unknown>>) {
  const ns =
    'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  const emitCell = (col0: number, row1: number, value: unknown) => {
    const ref = `${toExcelColumnName(col0)}${row1}`;
    if (isFiniteNumber(value)) {
      return `<c r="${ref}"><v>${value}</v></c>`;
    }
    if (typeof value === "boolean") {
      return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
    }
    const s = value == null ? "" : String(value);
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(s)}</t></is></c>`;
  };

  let sheetData = "";

  // Header row
  sheetData += `<row r="1">`;
  for (let c = 0; c < headers.length; c++) {
    sheetData += emitCell(c, 1, headers[c]);
  }
  sheetData += `</row>`;

  // Data rows
  for (let r = 0; r < rows.length; r++) {
    const rowNum = r + 2;
    sheetData += `<row r="${rowNum}">`;
    const row = rows[r] ?? {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c]!;
      sheetData += emitCell(c, rowNum, (row as any)[key]);
    }
    sheetData += `</row>`;
  }

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet ${ns}>` +
    `<sheetPr><tabColor rgb="FF1F77B4"/></sheetPr>` +
    `<dimension ref="A1:${toExcelColumnName(Math.max(0, headers.length - 1))}${Math.max(1, rows.length + 1)}"/>` +
    `<sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<sheetData>${sheetData}</sheetData>` +
    `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
    `</worksheet>`
  );
}

type WorkbookSheet = {
  name: string;
  rows: Array<Record<string, unknown>>;
};

function writeXlsxWorkbook(filePath: string, sheets: WorkbookSheet[]) {
  const safeSheets = sheets.length ? sheets : [{ name: "Results", rows: [] }];

  const now = new Date();
  const iso = now.toISOString();

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<workbookPr/>` +
    `<sheets>` +
    safeSheets
      .map(
        (s, i) =>
          `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
      )
      .join("") +
    `</sheets>` +
    `</workbook>`;

  const workbookRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    safeSheets
      .map(
        (_s, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const rootRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    safeSheets
      .map(
        (_s, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`;

  // Minimal styles (required by some Excel versions)
  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  const coreXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" ` +
    `xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:dcmitype="http://purl.org/dc/dcmitype/" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>LBP Simulator Sweep</dc:title>` +
    `<dc:creator>lbp-simulator</dc:creator>` +
    `<cp:lastModifiedBy>lbp-simulator</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
    `</cp:coreProperties>`;

  const appXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
    `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>lbp-simulator</Application>` +
    `<DocSecurity>0</DocSecurity>` +
    `<ScaleCrop>false</ScaleCrop>` +
    `<HeadingPairs><vt:vector size="2" baseType="vt:variant">` +
    `<vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>` +
    `<vt:variant><vt:i4>${safeSheets.length}</vt:i4></vt:variant>` +
    `</vt:vector></HeadingPairs>` +
    `<TitlesOfParts><vt:vector size="${safeSheets.length}" baseType="vt:lpstr">` +
    safeSheets
      .map((s) => `<vt:lpstr>${xmlEscape(s.name)}</vt:lpstr>`)
      .join("") +
    `</vt:vector></TitlesOfParts>` +
    `<Company></Company>` +
    `<LinksUpToDate>false</LinksUpToDate>` +
    `<SharedDoc>false</SharedDoc>` +
    `<HyperlinksChanged>false</HyperlinksChanged>` +
    `<AppVersion>16.0000</AppVersion>` +
    `</Properties>`;

  const zippedEntries: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypesXml),
    "_rels/.rels": strToU8(rootRelsXml),
    "docProps/core.xml": strToU8(coreXml),
    "docProps/app.xml": strToU8(appXml),
    "xl/workbook.xml": strToU8(workbookXml),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelsXml),
    "xl/styles.xml": strToU8(stylesXml),
  };

  for (let i = 0; i < safeSheets.length; i++) {
    const s = safeSheets[i]!;
    const headers = s.rows.length ? Object.keys(s.rows[0] ?? {}) : [];
    const sheetXml = buildSheetXml(s.name, headers, s.rows);
    zippedEntries[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml);
  }

  const zipped = zipSync(zippedEntries, { level: 6 });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(zipped));
}

function writeXlsxFile(filePath: string, rows: Array<Record<string, unknown>>) {
  writeXlsxWorkbook(filePath, [{ name: "Results", rows }]);
}

describe("Project scenario files", () => {
  const files = listScenarioFiles();

  it("should have at least one scenario file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const filePath of files) {
    it(`runs without NaNs: ${path.basename(filePath)}`, () => {
      const raw = fs.readFileSync(filePath, "utf8");
      const scenario = JSON.parse(raw) as ScenarioFile;

      const cases = scenario.cases?.length
        ? scenario.cases
        : [{ id: "base", label: "Base", overrides: {} }];

      for (const c of cases) {
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

        expect(snapshots.length).toBe(steps + 1);
        expect(snapshots[0].time).toBe(0);
        expect(snapshots[snapshots.length - 1].time).toBe(lbpConfig.duration);

        for (const s of snapshots) {
          expect(Number.isFinite(s.price)).toBe(true);
          expect(s.price).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(s.tknBalance)).toBe(true);
          expect(Number.isFinite(s.usdcBalance)).toBe(true);
          expect(s.tknBalance).toBeGreaterThanOrEqual(-1e-9);
          expect(s.usdcBalance).toBeGreaterThanOrEqual(-1e-9);
          expect(s.tknWeight).toBeGreaterThanOrEqual(0);
          expect(s.tknWeight).toBeLessThanOrEqual(100);
          expect(s.usdcWeight).toBeGreaterThanOrEqual(0);
          expect(s.usdcWeight).toBeLessThanOrEqual(100);
        }
      }
    });
  }
});

describe("AmplifyWorld parameter sweep summary", () => {
  it(
    "runs multiple parameter variations and prints a compact summary",
    { timeout: 20_000 },
    () => {
    const filePath = path.resolve(process.cwd(), "scenarios/amplifyworld.json");
    if (!fs.existsSync(filePath)) {
      // No scenario file in this repo checkout — don't fail CI for that.
      return;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const scenario = JSON.parse(raw) as ScenarioFile;

    const base = scenario.base;
    const wallets = scenario.project?.registeredWallets ?? 12_000;
    const steps = base.steps ?? 300;

    const baseCfg = normalizeWeights(base.lbpConfig);
    const baseDemand = base.demandConfig;
    const baseSell = base.sellConfig;

    const BUY_ONLY_SELL_CONFIG: SellPressureConfig = {
      preset: "loyal",
      loyalSoldPct: 0,
      loyalConcentrationPct: 60,
      greedySpreadPct: 2,
      greedySellPct: 0,
    };

    const ASSUMED_ETH_USD = 3000;
    const toCollateralUnits = (collateralToken: LBPConfig["collateralToken"], amountUsd: number) => {
      if (collateralToken === "ETH" || collateralToken === "wETH") {
        return amountUsd / ASSUMED_ETH_USD;
      }
      return amountUsd;
    };

    const collateralTokens: Array<LBPConfig["collateralToken"]> = ["USDC", "ETH"];

    const startWeights = [98, 95, 90];
    const endWeights = [50, 30, 10]; // includes classic 90/10 -> 10/90 style
    const swapFeesPct = [1, 2, 3];
	    const initialCollateralUsdByToken = (collateralToken: LBPConfig["collateralToken"]) => {
	      if (collateralToken === "ETH" || collateralToken === "wETH") {
	        // Larger ranges are useful with volatile collateral (ETH).
	        return [1_000_000, 3_000_000, 10_000_000, 30_000_000, 100_000_000];
	      }
	      // Seedless-compatible: include larger starting collateral so initial price isn't tiny.
	      return [300_000, 1_000_000, 3_000_000, 10_000_000, 30_000_000, 100_000_000];
	    };

    const demandLevelsUsd: Array<{ id: string; preset: DemandPressureConfig["preset"]; endUsd: number }> = [
      { id: "d50k", preset: "bullish", endUsd: 50_000 },
      { id: "d100k", preset: "bullish", endUsd: 100_000 },
      { id: "d250k", preset: "bullish", endUsd: 250_000 },
      { id: "d500k", preset: "bullish", endUsd: 500_000 },
      { id: "d1m", preset: "bullish", endUsd: 1_000_000 },
      { id: "d2m", preset: "bullish", endUsd: 2_000_000 },
      { id: "d5m", preset: "bullish", endUsd: 5_000_000 },
      { id: "d10m", preset: "bullish", endUsd: 10_000_000 },
      { id: "bear1m", preset: "bearish", endUsd: 1_000_000 },
      { id: "bear5m", preset: "bearish", endUsd: 5_000_000 },
    ];

    const sellModes: Array<{ id: string; sell: SellPressureConfig }> = [
      // Loyal: vary total sold and concentration.
      { id: "loyal2c40", sell: { ...baseSell, preset: "loyal", loyalSoldPct: 2, loyalConcentrationPct: 40 } },
      { id: "loyal5c60", sell: { ...baseSell, preset: "loyal", loyalSoldPct: 5, loyalConcentrationPct: 60 } },
      { id: "loyal10c80", sell: { ...baseSell, preset: "loyal", loyalSoldPct: 10, loyalConcentrationPct: 80 } },
      { id: "loyal20c80", sell: { ...baseSell, preset: "loyal", loyalSoldPct: 20, loyalConcentrationPct: 80 } },
      // Greedy: vary trigger spread and sell fraction.
      { id: "greedy2_25", sell: { ...baseSell, preset: "greedy", greedySpreadPct: 2, greedySellPct: 25 } },
      { id: "greedy5_50", sell: { ...baseSell, preset: "greedy", greedySpreadPct: 5, greedySellPct: 50 } },
      { id: "greedy10_100", sell: { ...baseSell, preset: "greedy", greedySpreadPct: 10, greedySellPct: 100 } },
    ];

    const summaries: Array<any> = [];

    for (const collateralToken of collateralTokens) {
      for (const w of startWeights) {
        for (const wOut of endWeights) {
          for (const fee of swapFeesPct) {
            for (const collUsd of initialCollateralUsdByToken(collateralToken)) {
              const collIn = toCollateralUnits(collateralToken, collUsd);
              for (const d of demandLevelsUsd) {
                const endUnits = toCollateralUnits(collateralToken, d.endUsd);
                const magBase = pickMagnitudeBaseForTarget(endUnits);
                const demand: DemandPressureConfig = {
                  ...baseDemand,
                  preset: d.preset,
                  magnitudeBase: magBase,
                  multiplier: endUnits / magBase,
                };

                for (const s of sellModes) {
                  const cfg: LBPConfig = normalizeWeights({
                    ...baseCfg,
                    collateralToken,
                    tknWeightIn: w,
                    usdcWeightIn: 100 - w,
                    tknWeightOut: wOut,
                    usdcWeightOut: 100 - wOut,
                    usdcBalanceIn: collIn,
                    swapFee: fee,
                  });

                const snapshots = runDeterministicSimulation(
                  cfg,
                  demand,
                  s.sell,
                  steps,
                );
                const snapshotsBuyOnly = runDeterministicSimulation(
                  cfg,
                  demand,
                  BUY_ONLY_SELL_CONFIG,
                  steps,
                );

                  expect(snapshots.length).toBe(steps + 1);
                  expect(snapshots[0].time).toBe(0);
                  expect(snapshots[snapshots.length - 1].time).toBe(cfg.duration);

                const summary = summarizeSnapshots(snapshots);
                const summaryBuyOnly = summarizeSnapshots(snapshotsBuyOnly);
                const swapsEst = estimateSwapEvents(
                  snapshots,
                  collateralToken,
                  ASSUMED_ETH_USD,
                );
                const swapsEstBuyOnly = estimateSwapEvents(
                  snapshotsBuyOnly,
                  collateralToken,
                  ASSUMED_ETH_USD,
                );
                expect(Number.isFinite(summary.finalPrice)).toBe(true);
                expect(Number.isFinite(summary.netRaised)).toBe(true);

                const demandEndUnits = estimateEndCumulativeBuys(demand);
                const demandEndUsd =
                  collateralToken === "ETH" || collateralToken === "wETH"
                    ? demandEndUnits * ASSUMED_ETH_USD
                    : demandEndUnits;

                summaries.push({
                  scenarioId: `coll${collateralToken}_w${w}_e${wOut}_fee${fee}_c${Math.round(collUsd / 1000)}k_${d.id}_${s.id}`,
                  collateralToken,
                  startWeightTknPct: w,
                  endWeightTknPct: wOut,
                  swapFeePct: fee,
                  initialCollateralUsd: collUsd,
                  initialCollateral: collIn,
                  demandInputUsd: d.endUsd,
                  demandInputUnits: endUnits,
                  demandEndCumulativeUsd: demandEndUsd,
                  demandEndCumulative: demandEndUnits,
                  sellBehavior: s.id,
                  netRaised: summary.netRaised,
                  netRaisedBuyOnly: summaryBuyOnly.netRaised,
                  initialPrice: summary.initialPrice,
                  minPrice: summary.minPrice,
                  finalPrice: summary.finalPrice,
                  minPriceBuyOnly: summaryBuyOnly.minPrice,
                  finalPriceBuyOnly: summaryBuyOnly.finalPrice,
                  communityHeld: summary.communityHeld,
                  communityAvgCost: summary.communityAvgCost,
                  communityHeldBuyOnly: summaryBuyOnly.communityHeld,
                  communityAvgCostBuyOnly: summaryBuyOnly.communityAvgCost,
                  estBuySwaps: swapsEst.estBuys,
                  estSellSwaps: swapsEst.estSells,
                  estSwaps: swapsEst.estTotal,
                  estBuySwapsBuyOnly: swapsEstBuyOnly.estBuys,
                  estSellSwapsBuyOnly: swapsEstBuyOnly.estSells,
                  estSwapsBuyOnly: swapsEstBuyOnly.estTotal,
                });
              }
            }
          }
        }
      }
    }
    }

    // Wallet-based demand examples (maps "12k wallets" into a few buy-volume targets).
    const participationRates = [0.01, 0.05, 0.1];
    const ticketsUsd = [100, 250, 500];

    for (const collateralToken of collateralTokens) {
      for (const p of participationRates) {
        for (const t of ticketsUsd) {
          const targetUsd = wallets * p * t;
          const targetUnits = toCollateralUnits(collateralToken, targetUsd);
          const magBase = pickMagnitudeBaseForTarget(targetUnits);
          const demand: DemandPressureConfig = {
            ...baseDemand,
            preset: "bullish",
            magnitudeBase: magBase,
            multiplier: targetUnits / magBase,
          };

          const cfg: LBPConfig = normalizeWeights({
            ...baseCfg,
            collateralToken,
            tknWeightIn: 95,
            usdcWeightIn: 5,
            tknWeightOut: 50,
            usdcWeightOut: 50,
            usdcBalanceIn: toCollateralUnits(collateralToken, 300_000),
            swapFee: 2,
          });

          const snapshots = runDeterministicSimulation(
            cfg,
            demand,
            { ...baseSell, preset: "loyal", loyalSoldPct: 5, loyalConcentrationPct: 60 },
            steps,
          );
          const snapshotsBuyOnly = runDeterministicSimulation(
            cfg,
            demand,
            BUY_ONLY_SELL_CONFIG,
            steps,
          );
          const summary = summarizeSnapshots(snapshots);
          const summaryBuyOnly = summarizeSnapshots(snapshotsBuyOnly);
          const swapsEst = estimateSwapEvents(
            snapshots,
            collateralToken,
            ASSUMED_ETH_USD,
          );
          const swapsEstBuyOnly = estimateSwapEvents(
            snapshotsBuyOnly,
            collateralToken,
            ASSUMED_ETH_USD,
          );

          const demandEndUnits = estimateEndCumulativeBuys(demand);
          const demandEndUsd =
            collateralToken === "ETH" || collateralToken === "wETH"
              ? demandEndUnits * ASSUMED_ETH_USD
              : demandEndUnits;

          summaries.push({
            scenarioId: `coll${collateralToken}_wallets_${Math.round(p * 100)}pct_ticket${t}`,
            collateralToken,
            startWeightTknPct: 95,
            endWeightTknPct: 50,
            swapFeePct: 2,
            initialCollateralUsd: 300_000,
            initialCollateral: cfg.usdcBalanceIn,
            demandInputUsd: targetUsd,
            demandInputUnits: targetUnits,
            demandEndCumulativeUsd: demandEndUsd,
            demandEndCumulative: demandEndUnits,
            sellBehavior: "loyal5",
            netRaised: summary.netRaised,
            netRaisedBuyOnly: summaryBuyOnly.netRaised,
            initialPrice: summary.initialPrice,
            minPrice: summary.minPrice,
            finalPrice: summary.finalPrice,
            minPriceBuyOnly: summaryBuyOnly.minPrice,
            finalPriceBuyOnly: summaryBuyOnly.finalPrice,
            communityHeld: summary.communityHeld,
            communityAvgCost: summary.communityAvgCost,
            communityHeldBuyOnly: summaryBuyOnly.communityHeld,
            communityAvgCostBuyOnly: summaryBuyOnly.communityAvgCost,
            estBuySwaps: swapsEst.estBuys,
            estSellSwaps: swapsEst.estSells,
            estSwaps: swapsEst.estTotal,
            estBuySwapsBuyOnly: swapsEstBuyOnly.estBuys,
            estSellSwapsBuyOnly: swapsEstBuyOnly.estSells,
            estSwapsBuyOnly: swapsEstBuyOnly.estTotal,
          });
        }
      }
    }

    // NOTE: Initial price depends only on initial balances + weights (not on demand curve).
    const MIN_INITIAL_PRICE_USD = Number(process.env.MIN_INITIAL_PRICE_USD ?? 0.02);
    const MAX_INITIAL_PRICE_USD =
      process.env.MAX_INITIAL_PRICE_USD != null
        ? Number(process.env.MAX_INITIAL_PRICE_USD)
        : Number.POSITIVE_INFINITY;
    const MIN_INITIAL_COLLATERAL_USD = Number(
      process.env.MIN_INITIAL_COLLATERAL_USD ?? 1_000_000,
    );
    const MAX_INITIAL_COLLATERAL_USD = Number(
      process.env.MAX_INITIAL_COLLATERAL_USD ?? 100_000_000,
    );
    const TARGET_DEMAND_INPUT_USD = Number(
      process.env.TARGET_DEMAND_INPUT_USD ?? 100_000,
    );
    const DEMAND_INPUT_TOLERANCE_PCT = Number(
      process.env.DEMAND_INPUT_TOLERANCE_PCT ?? 0,
    );
	    const MIN_DEMAND_INPUT_USD = Number(process.env.MIN_DEMAND_INPUT_USD ?? 50_000);
	    const MAX_DEMAND_INPUT_USD = Number(process.env.MAX_DEMAND_INPUT_USD ?? 500_000);
	    const RECOMMENDATION_MODE = (process.env.RECOMMENDATION_MODE ??
	      "buy-and-sell") as "buy-and-sell" | "buy-only";
	    const RECOMMENDATION_PICK = (process.env.RECOMMENDATION_PICK ??
	      "diverse") as "diverse" | "strict";
	    const FIX_START_WEIGHT_TKN_PCT =
	      process.env.FIX_START_WEIGHT_TKN_PCT != null
	        ? Number(process.env.FIX_START_WEIGHT_TKN_PCT)
	        : undefined;
	    const FIX_END_WEIGHT_TKN_PCT =
	      process.env.FIX_END_WEIGHT_TKN_PCT != null
	        ? Number(process.env.FIX_END_WEIGHT_TKN_PCT)
	        : undefined;

    const sellBehaviorMeaning = (sellBehavior: string) => {
      if (sellBehavior.startsWith("loyal")) {
        // loyal{soldPct}c{concentration}
        const m = sellBehavior.match(/^loyal(\d+(?:\.\d+)?)c(\d+(?:\.\d+)?)$/);
        if (m) {
          const soldPct = Number(m[1]);
          const conc = Number(m[2]);
          return `Loyal: sells ${soldPct}% total; ${conc}% weight at start+end`;
        }
        return "Loyal community (see loyal params)";
      }
      if (sellBehavior.startsWith("greedy")) {
        // greedy{spread}_{sellPct}
        const m = sellBehavior.match(/^greedy(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)$/);
        if (m) {
          const spread = Number(m[1]);
          const sellPct = Number(m[2]);
          return `Greedy: triggers at +${spread}% over avg cost; sells ${sellPct}% per trigger`;
        }
        return "Greedy community (see greedy params)";
      }
      return sellBehavior;
    };

    const toUsd = (collateralToken: LBPConfig["collateralToken"], amountInCollateral: number) => {
      if (collateralToken === "ETH" || collateralToken === "wETH") return amountInCollateral * ASSUMED_ETH_USD;
      return amountInCollateral;
    };

	    const initialPriceUsd = (r: any) => toUsd(r.collateralToken, Number(r.initialPrice ?? 0));
	    const finalPriceUsd = (r: any) => toUsd(r.collateralToken, Number(r.finalPrice ?? 0));
	    const netRaisedUsd = (r: any) => toUsd(r.collateralToken, Number(r.netRaised ?? 0));
	    const minPriceUsdBuyOnly = (r: any) =>
	      toUsd(r.collateralToken, Number(r.minPriceBuyOnly ?? 0));
	    const finalPriceUsdBuyOnly = (r: any) =>
	      toUsd(r.collateralToken, Number(r.finalPriceBuyOnly ?? 0));
	    const netRaisedUsdBuyOnly = (r: any) =>
	      toUsd(r.collateralToken, Number(r.netRaisedBuyOnly ?? 0));

	    const pickRecommended = (collateralToken: LBPConfig["collateralToken"]) => {
	      const isBuyOnly = RECOMMENDATION_MODE === "buy-only";
	      const allowedSell = new Set([
	        "loyal5c60",
	        "loyal10c80",
	        "greedy2_25",
	        "greedy5_50",
	      ]);
      const sellPreference = new Map<string, number>([
        ["loyal5c60", 0],
        ["loyal10c80", 1],
        ["greedy2_25", 2],
        ["greedy5_50", 3],
      ]);

	      const candidates = summaries
	        .filter((r) => r.collateralToken === collateralToken)
	        .filter((r) => (isBuyOnly ? true : allowedSell.has(String(r.sellBehavior))))
	        .filter((r) => Number(r.initialCollateralUsd) >= MIN_INITIAL_COLLATERAL_USD)
	        .filter((r) => Number(r.initialCollateralUsd) <= MAX_INITIAL_COLLATERAL_USD)
	        .filter((r) => Number(r.demandInputUsd) >= MIN_DEMAND_INPUT_USD)
	        .filter((r) => Number(r.demandInputUsd) <= MAX_DEMAND_INPUT_USD)
	        .filter((r) => initialPriceUsd(r) >= MIN_INITIAL_PRICE_USD)
	        .filter((r) =>
	          FIX_START_WEIGHT_TKN_PCT == null
	            ? true
	            : Number(r.startWeightTknPct) === FIX_START_WEIGHT_TKN_PCT,
	        )
	        .filter((r) =>
	          FIX_END_WEIGHT_TKN_PCT == null
	            ? true
	            : Number(r.endWeightTknPct) === FIX_END_WEIGHT_TKN_PCT,
	        );
      const candidatesWithMax = candidates.filter(
        (r) => initialPriceUsd(r) <= MAX_INITIAL_PRICE_USD,
      );

      const targetLo =
        TARGET_DEMAND_INPUT_USD * (1 - DEMAND_INPUT_TOLERANCE_PCT / 100);
      const targetHi =
        TARGET_DEMAND_INPUT_USD * (1 + DEMAND_INPUT_TOLERANCE_PCT / 100);

	      const targetDemandRaw = candidatesWithMax.filter((r) => {
	        const v = Number(r.demandInputUsd);
	        if (!Number.isFinite(v)) return false;
	        return v >= targetLo && v <= targetHi;
	      });

	      // In buy-only mode, sell behavior has no effect on the outcome, so dedupe it out
	      // to avoid returning multiple identical parameter sets.
	      const targetDemand = (() => {
	        if (!isBuyOnly) return targetDemandRaw;
	        const byKey = new Map<string, any>();
	        for (const r of targetDemandRaw) {
	          const key = [
	            r.collateralToken,
	            r.startWeightTknPct,
	            r.endWeightTknPct,
	            r.swapFeePct,
	            r.initialCollateralUsd,
	            r.demandInputUsd,
	          ].join("|");
	          if (!byKey.has(key)) byKey.set(key, r);
	        }
	        return Array.from(byKey.values());
	      })();

	      const sorted = [...targetDemand].sort((a, b) => {
	        // Objective 1: higher initial price (anti "cheap token" sniping).
	        const p0 = initialPriceUsd(b) - initialPriceUsd(a);
	        if (p0 !== 0) return p0;

	        if (isBuyOnly) {
	          // Objective 2 (buy-only): higher final price with sells disabled.
	          const pf = finalPriceUsdBuyOnly(b) - finalPriceUsdBuyOnly(a);
	          if (pf !== 0) return pf;
	          // Objective 3: higher minimum price (avoid big dips during weight shift).
	          const pm = minPriceUsdBuyOnly(b) - minPriceUsdBuyOnly(a);
	          if (pm !== 0) return pm;
	          // Objective 4: higher net raised (should be ~demand in buy-only).
	          return netRaisedUsdBuyOnly(b) - netRaisedUsdBuyOnly(a);
	        }

	        // Secondary (buy+sell): prefer more realistic sell behaviors (loyal first), then net raised.
	        const pa = sellPreference.get(String(a.sellBehavior)) ?? 999;
	        const pb = sellPreference.get(String(b.sellBehavior)) ?? 999;
	        if (pa !== pb) return pa - pb;
	        return netRaisedUsd(b) - netRaisedUsd(a);
	      });

	      if (RECOMMENDATION_PICK === "strict") {
	        return sorted.slice(0, 5);
	      }

	      const picked: any[] = [];
	      const seen = new Set<string>();
	      const push = (r: any) => {
	        if (!r) return;
	        const id = isBuyOnly
	          ? [
	              r.collateralToken,
	              r.startWeightTknPct,
	              r.endWeightTknPct,
	              r.swapFeePct,
	              r.initialCollateralUsd,
	              r.demandInputUsd,
	            ].join("|")
	          : String(r.scenarioId);
	        if (seen.has(id)) return;
	        seen.add(id);
	        picked.push(r);
	      };

      // Must-include: at least one 90/10 -> 10/90 case if available.
      push(
        sorted.find(
          (r) =>
            Number(r.startWeightTknPct) === 90 && Number(r.endWeightTknPct) === 10,
        ),
      );

      // Prefer diversity across initial collateral levels (seedless setups).
      const preferredCollateralUsd = [1_000_000, 3_000_000, 10_000_000, 30_000_000, 100_000_000];
      for (const collUsd of preferredCollateralUsd) {
        for (const r of sorted) {
          if (picked.length >= 5) break;
          if (Number(r.initialCollateralUsd) !== collUsd) continue;
          push(r);
          break; // only one per collateral bucket
        }
        if (picked.length >= 5) break;
      }

      // Then prefer diversity across end weights (50/30/10).
      for (const ew of [50, 30, 10]) {
        for (const r of sorted) {
          if (picked.length >= 5) break;
          if (Number(r.endWeightTknPct) !== ew) continue;
          push(r);
        }
        if (picked.length >= 5) break;
      }

      // Fill remaining slots with best remaining.
      for (const r of sorted) {
        if (picked.length >= 5) break;
        push(r);
      }

      return picked.slice(0, 5);
    };

    const recommendedUSDC = pickRecommended("USDC");
    const recommendedETH = pickRecommended("ETH");

	    // eslint-disable-next-line no-console
	    console.log(
	      `[AmplifyWorld recommended] Constraints: initialPriceUsd>=${MIN_INITIAL_PRICE_USD}, ` +
	        (Number.isFinite(MAX_INITIAL_PRICE_USD)
	          ? `initialPriceUsd<=${MAX_INITIAL_PRICE_USD}, `
	          : "") +
	        `initialCollateralUsd=${MIN_INITIAL_COLLATERAL_USD}..${MAX_INITIAL_COLLATERAL_USD}, demandInputUsd=${MIN_DEMAND_INPUT_USD}..${MAX_DEMAND_INPUT_USD}, ` +
	        `targetDemandInputUsd=${TARGET_DEMAND_INPUT_USD} (+/-${DEMAND_INPUT_TOLERANCE_PCT}%), ` +
	        (FIX_START_WEIGHT_TKN_PCT != null
	          ? `startWeightTknPct=${FIX_START_WEIGHT_TKN_PCT}, `
	          : "") +
	        (FIX_END_WEIGHT_TKN_PCT != null ? `endWeightTknPct=${FIX_END_WEIGHT_TKN_PCT}, ` : "") +
	        `mode=${RECOMMENDATION_MODE}, pick=${RECOMMENDATION_PICK}, ETH=${ASSUMED_ETH_USD} USD.`,
	    );
	    // eslint-disable-next-line no-console
	    console.log(
	      `[AmplifyWorld recommended] mode=${RECOMMENDATION_MODE} (Top 5 USDC):`,
	    );
    // eslint-disable-next-line no-console
    console.table(
      recommendedUSDC.map((r) => ({
        ScenarioId: r.scenarioId,
        Weights: `${r.startWeightTknPct}/${100 - r.startWeightTknPct} -> ${r.endWeightTknPct}/${100 - r.endWeightTknPct}`,
        SwapFeePct: r.swapFeePct,
        InitialCollateralUsd: formatNumber(r.initialCollateralUsd, 0),
        DemandInputUsd: formatNumber(r.demandInputUsd, 0),
        SellBehavior: sellBehaviorMeaning(String(r.sellBehavior)),
        InitialPriceUsd: initialPriceUsd(r),
        NetRaisedUsd: netRaisedUsd(r),
        NetRaisedUsdBuyOnly: netRaisedUsdBuyOnly(r),
        EstSwaps: Number(r.estSwaps ?? 0),
        EstSwapsBuyOnly: Number(r.estSwapsBuyOnly ?? 0),
        FinalPriceUsd: finalPriceUsd(r),
        FinalPriceUsdBuyOnly: finalPriceUsdBuyOnly(r),
      })),
    );
	    // eslint-disable-next-line no-console
	    console.log(
	      `[AmplifyWorld recommended] mode=${RECOMMENDATION_MODE} (Top 5 ETH):`,
	    );
    // eslint-disable-next-line no-console
    console.table(
      recommendedETH.map((r) => ({
        ScenarioId: r.scenarioId,
        Weights: `${r.startWeightTknPct}/${100 - r.startWeightTknPct} -> ${r.endWeightTknPct}/${100 - r.endWeightTknPct}`,
        SwapFeePct: r.swapFeePct,
        InitialCollateralUsd: formatNumber(r.initialCollateralUsd, 0),
        DemandInputUsd: formatNumber(r.demandInputUsd, 0),
        SellBehavior: sellBehaviorMeaning(String(r.sellBehavior)),
        InitialPriceUsd: initialPriceUsd(r),
        NetRaisedUsd: netRaisedUsd(r),
        NetRaisedUsdBuyOnly: netRaisedUsdBuyOnly(r),
        EstSwaps: Number(r.estSwaps ?? 0),
        EstSwapsBuyOnly: Number(r.estSwapsBuyOnly ?? 0),
        FinalPriceUsd: finalPriceUsd(r),
        FinalPriceUsdBuyOnly: finalPriceUsdBuyOnly(r),
      })),
    );

	    if (process.env.EXPORT_XLSX === "1") {
	      const recommendedRows = [...recommendedUSDC, ...recommendedETH].map((r) => ({
	        ScenarioId: r.scenarioId,
	        PressureMode: RECOMMENDATION_MODE,
	        CollateralToken: r.collateralToken,
	        StartWeightTknPct: r.startWeightTknPct,
	        EndWeightTknPct: r.endWeightTknPct,
	        SwapFeePct: r.swapFeePct,
	        InitialCollateralUsd: r.initialCollateralUsd,
	        DemandInputUsd: r.demandInputUsd,
	        SellBehavior:
	          RECOMMENDATION_MODE === "buy-only"
	            ? "Buy-only (sells disabled)"
	            : sellBehaviorMeaning(String(r.sellBehavior)),
	        SellBehaviorOriginal: sellBehaviorMeaning(String(r.sellBehavior)),
	        InitialPriceUsd: initialPriceUsd(r),
	        MinPriceUsd: toUsd(r.collateralToken, Number(r.minPrice ?? 0)),
	        FinalPriceUsd: finalPriceUsd(r),
	        NetRaisedUsd: netRaisedUsd(r),
	        MinPriceUsdBuyOnly: minPriceUsdBuyOnly(r),
	        FinalPriceUsdBuyOnly: finalPriceUsdBuyOnly(r),
	        NetRaisedUsdBuyOnly: netRaisedUsdBuyOnly(r),
          EstSwaps: Number(r.estSwaps ?? 0),
          EstSwapsBuyOnly: Number(r.estSwapsBuyOnly ?? 0),
	        CommunityHeld: r.communityHeld,
	        CommunityAvgCostUsd: toUsd(r.collateralToken, Number(r.communityAvgCost ?? 0)),
	      }));

      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
      ].join("");
      const outPath = path.resolve(
        process.cwd(),
        `out/amplifyworld-recommended-${stamp}.xlsx`,
      );
      writeXlsxFile(outPath, recommendedRows);
      // eslint-disable-next-line no-console
      console.log(`[AmplifyWorld recommended] XLSX exported: ${outPath}`);
    }

    if (process.env.EXPORT_CSV === "1") {
      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
      ].join("");
      const outPath = path.resolve(
        process.cwd(),
        `out/amplifyworld-sweep-${stamp}.csv`,
      );
      writeCsvFile(outPath, summaries);
      // eslint-disable-next-line no-console
      console.log(`[AmplifyWorld sweep] CSV exported: ${outPath}`);
    }

    if (process.env.EXPORT_XLSX === "1") {
      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
      ].join("");
      const outPath = path.resolve(
        process.cwd(),
        `out/amplifyworld-sweep-${stamp}.xlsx`,
      );
      writeXlsxFile(outPath, summaries);
      // eslint-disable-next-line no-console
      console.log(`[AmplifyWorld sweep] XLSX exported: ${outPath}`);
    }

    if (process.env.EXPORT_TABLES_XLSX === "1") {
      const tableAIds = [
        "collUSDC_w90_e10_fee3_c300k_d5m_loyal2c40",
        "collUSDC_w90_e10_fee3_c300k_d5m_loyal5c60",
        "collUSDC_w90_e10_fee3_c300k_d5m_loyal10c80",
        "collUSDC_w98_e10_fee3_c1000k_d5m_greedy2_25",
        "collUSDC_w98_e10_fee3_c1000k_d5m_greedy5_50",
        "collETH_w90_e10_fee3_c1000k_d5m_loyal2c40",
        "collETH_w90_e10_fee3_c1000k_d5m_loyal5c60",
        "collETH_w90_e10_fee3_c1000k_d5m_loyal10c80",
        "collETH_w98_e10_fee3_c3000k_d5m_greedy2_25",
        "collETH_w98_e10_fee3_c3000k_d5m_greedy5_50",
      ];

      const tableBIds = [
        "collUSDC_w90_e10_fee3_c100000k_d100k_loyal5c60",
        "collUSDC_w98_e10_fee3_c1000k_d100k_loyal5c60",
        "collUSDC_w98_e10_fee3_c3000k_d100k_loyal5c60",
        "collUSDC_w98_e10_fee3_c10000k_d100k_loyal5c60",
        "collUSDC_w95_e10_fee3_c30000k_d100k_loyal5c60",
        "collETH_w90_e10_fee3_c100000k_d100k_loyal5c60",
        "collETH_w98_e10_fee3_c1000k_d100k_loyal5c60",
        "collETH_w98_e10_fee3_c3000k_d100k_loyal5c60",
        "collETH_w98_e10_fee3_c10000k_d100k_loyal5c60",
        "collETH_w95_e10_fee3_c30000k_d100k_loyal5c60",
      ];

      const tableCIds = [
        "collUSDC_w98_e50_fee1_c100000k_d100k_loyal2c40",
        "collUSDC_w98_e50_fee2_c100000k_d100k_loyal2c40",
        "collUSDC_w98_e50_fee3_c100000k_d100k_loyal2c40",
        "collUSDC_w98_e30_fee1_c100000k_d100k_loyal2c40",
        "collUSDC_w98_e30_fee2_c100000k_d100k_loyal2c40",
        "collETH_w98_e50_fee1_c100000k_d100k_loyal2c40",
        "collETH_w98_e50_fee2_c100000k_d100k_loyal2c40",
        "collETH_w98_e50_fee3_c100000k_d100k_loyal2c40",
        "collETH_w98_e30_fee1_c100000k_d100k_loyal2c40",
        "collETH_w98_e30_fee2_c100000k_d100k_loyal2c40",
      ];

      const weightsLabel = (r: any) =>
        `${r.startWeightTknPct}/${100 - Number(r.startWeightTknPct)} -> ${r.endWeightTknPct}/${100 - Number(r.endWeightTknPct)}`;

      const byId = new Map<string, any>(summaries.map((s) => [String(s.scenarioId), s]));
      const missing = [...tableAIds, ...tableBIds, ...tableCIds].filter((id) => !byId.has(id));
      if (missing.length) {
        // eslint-disable-next-line no-console
        console.log(`[AmplifyWorld tables] Missing scenarios (${missing.length}):`, missing);
      }

      const tableARows = tableAIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((r) => ({
          ScenarioId: r.scenarioId,
          CollateralToken: r.collateralToken,
          Weights: weightsLabel(r),
          SwapFeePct: Number(r.swapFeePct),
          InitialCollateralUsd: Number(r.initialCollateralUsd),
          DemandInputUsd: Number(r.demandInputUsd),
          SellBehavior: sellBehaviorMeaning(String(r.sellBehavior)),
          NetRaisedUsd: netRaisedUsd(r),
          InitialPriceUsd: initialPriceUsd(r),
          MinPriceUsd: toUsd(r.collateralToken, Number(r.minPrice ?? 0)),
          FinalPriceUsd: finalPriceUsd(r),
          EstimatedSwaps: Number(r.estSwaps ?? 0),
          EstimatedBuySwaps: Number(r.estBuySwaps ?? 0),
          EstimatedSellSwaps: Number(r.estSellSwaps ?? 0),
          CommunityHeld: Number(r.communityHeld ?? 0),
          CommunityAvgCostUsd: toUsd(r.collateralToken, Number(r.communityAvgCost ?? 0)),
        }));

      const tableBRows = tableBIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((r) => ({
          ScenarioId: r.scenarioId,
          CollateralToken: r.collateralToken,
          Weights: weightsLabel(r),
          SwapFeePct: Number(r.swapFeePct),
          InitialCollateralUsd: Number(r.initialCollateralUsd),
          DemandInputUsd: Number(r.demandInputUsd),
          SellBehavior: sellBehaviorMeaning(String(r.sellBehavior)),
          NetRaisedUsd: netRaisedUsd(r),
          InitialPriceUsd: initialPriceUsd(r),
          FinalPriceUsd: finalPriceUsd(r),
          EstimatedSwaps: Number(r.estSwaps ?? 0),
        }));

      const tableCRows = tableCIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((r) => ({
          ScenarioId: r.scenarioId,
          CollateralToken: r.collateralToken,
          Weights: weightsLabel(r),
          SwapFeePct: Number(r.swapFeePct),
          InitialCollateralUsd: Number(r.initialCollateralUsd),
          DemandInputUsd: Number(r.demandInputUsd),
          SellBehavior: sellBehaviorMeaning(String(r.sellBehavior)),
          InitialPriceUsd: initialPriceUsd(r),
          FinalPriceUsdBuyOnly: finalPriceUsdBuyOnly(r),
          NetRaisedUsdBuyOnly: netRaisedUsdBuyOnly(r),
          EstimatedSwapsBuyOnly: Number(r.estSwapsBuyOnly ?? 0),
          EstimatedBuySwapsBuyOnly: Number(r.estBuySwapsBuyOnly ?? 0),
          EstimatedSellSwapsBuyOnly: Number(r.estSellSwapsBuyOnly ?? 0),
        }));

      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
      ].join("");

      const outPath = path.resolve(
        process.cwd(),
        `out/amplifyworld-3tables-${stamp}.xlsx`,
      );
      writeXlsxWorkbook(outPath, [
        { name: "Table A (d5m mix)", rows: tableARows },
        { name: "Table B (seedless)", rows: tableBRows },
        { name: "Table C (buy-only)", rows: tableCRows },
      ]);
      // eslint-disable-next-line no-console
      console.log(`[AmplifyWorld tables] XLSX exported: ${outPath}`);
    }

    const topRaised = [...summaries].sort((a, b) => b.netRaised - a.netRaised).slice(0, 12);
    const bottomRaised = [...summaries].sort((a, b) => a.netRaised - b.netRaised).slice(0, 12);

    // eslint-disable-next-line no-console
    console.log(
      `[AmplifyWorld sweep] scenarios=${summaries.length} (wallets=${wallets.toLocaleString()})`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[AmplifyWorld sweep] Units: prices are collateral/token; NetRaised and DemandEndCumulative are in collateral units. ` +
        `ETH conversions assume ${ASSUMED_ETH_USD.toLocaleString()} USD/ETH.`,
    );
    // eslint-disable-next-line no-console
    console.log("[AmplifyWorld sweep] Top net raised (buys - sells):");
    // eslint-disable-next-line no-console
    console.table(
      topRaised.map((s) => ({
        ScenarioId: s.scenarioId,
        CollateralToken: s.collateralToken,
        SwapFeePct: s.swapFeePct,
        StartWeightTknPct: s.startWeightTknPct,
        InitialCollateralUsd: formatNumber(s.initialCollateralUsd, 0),
        InitialCollateral: formatNumber(s.initialCollateral, 6),
        DemandEndCumulativeUsd: formatNumber(s.demandEndCumulativeUsd, 0),
        DemandEndCumulative: formatNumber(s.demandEndCumulative, 6),
        SellBehavior: s.sellBehavior,
        NetRaised: formatNumber(s.netRaised, 6),
        EstSwaps: Number(s.estSwaps ?? 0),
        InitialPrice: formatNumber(s.initialPrice, 10),
        MinPrice: formatNumber(s.minPrice, 10),
        FinalPrice: formatNumber(s.finalPrice, 10),
        CommunityHeld: formatNumber(s.communityHeld, 2),
      })),
    );

    // eslint-disable-next-line no-console
    console.log("[AmplifyWorld sweep] Bottom net raised:");
    // eslint-disable-next-line no-console
    console.table(
      bottomRaised.map((s) => ({
        ScenarioId: s.scenarioId,
        CollateralToken: s.collateralToken,
        SwapFeePct: s.swapFeePct,
        StartWeightTknPct: s.startWeightTknPct,
        InitialCollateralUsd: formatNumber(s.initialCollateralUsd, 0),
        InitialCollateral: formatNumber(s.initialCollateral, 6),
        DemandEndCumulativeUsd: formatNumber(s.demandEndCumulativeUsd, 0),
        DemandEndCumulative: formatNumber(s.demandEndCumulative, 6),
        SellBehavior: s.sellBehavior,
        NetRaised: formatNumber(s.netRaised, 6),
        EstSwaps: Number(s.estSwaps ?? 0),
        InitialPrice: formatNumber(s.initialPrice, 10),
        MinPrice: formatNumber(s.minPrice, 10),
        FinalPrice: formatNumber(s.finalPrice, 10),
        CommunityHeld: formatNumber(s.communityHeld, 2),
      })),
    );
    },
  );
});

describe("Nerite parameter sweep summary", () => {
  it(
    "runs multiple parameter variations and prints a compact summary",
    { timeout: 15_000 },
    () => {
      const filePath = path.resolve(process.cwd(), "scenarios/nerite.json");
      if (!fs.existsSync(filePath)) {
        // No scenario file in this repo checkout — don't fail CI for that.
        return;
      }

      const raw = fs.readFileSync(filePath, "utf8");
      const scenario = JSON.parse(raw) as ScenarioFile;

      const base = scenario.base;
      const steps = base.steps ?? 720;
      const baseCfg = normalizeWeights(base.lbpConfig);
      const baseDemand = base.demandConfig;
      const baseSell = base.sellConfig;

      if (baseCfg.collateralToken !== "USDC" && baseCfg.collateralToken !== "USDT") {
        throw new Error(
          `Nerite sweep expects stable collateral (USDC/USDT). Got: ${baseCfg.collateralToken}`,
        );
      }

      const BUY_ONLY_SELL_CONFIG: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 0,
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 0,
      };

      const ASSUMED_ETH_USD = 3000;

      const weightPairs: Array<{ start: number; end: number }> = [
        { start: 98, end: 50 },
        { start: 95, end: 50 },
        { start: 98, end: 30 },
        // Classic Balancer LBP weight curve (90/10 -> 10/90)
        { start: 90, end: 10 },
      ];
      const swapFeesPct = [1, 2, 3];
      const initialCollateralUsd = [500_000, 1_500_000, 3_000_000];
      const demandLevelsUsd = [1_000_000, 3_000_000, 5_000_000, 10_000_000];

      const sellModes: Array<{ id: string; sell: SellPressureConfig }> = [
        { id: "buyOnly", sell: BUY_ONLY_SELL_CONFIG },
        {
          id: "loyal5c60",
          sell: { ...baseSell, preset: "loyal", loyalSoldPct: 5, loyalConcentrationPct: 60 },
        },
        {
          id: "greedy5_50",
          sell: { ...baseSell, preset: "greedy", greedySpreadPct: 5, greedySellPct: 50 },
        },
      ];

      const summaries: Array<Record<string, unknown>> = [];

      for (const pair of weightPairs) {
        const startWeightTknPct = pair.start;
        const endWeightTknPct = pair.end;

        for (const swapFeePct of swapFeesPct) {
          for (const initialUsd of initialCollateralUsd) {
            for (const demandUsd of demandLevelsUsd) {
              const magnitudeBase = pickMagnitudeBaseForTarget(demandUsd);
              const demandConfig: DemandPressureConfig = {
                ...baseDemand,
                preset: "bullish",
                magnitudeBase,
                multiplier: demandUsd / magnitudeBase,
              };

              for (const sellMode of sellModes) {
                const scenarioId = [
                  "collUSDC",
                  `w${startWeightTknPct}`,
                  `e${endWeightTknPct}`,
                  `fee${swapFeePct}`,
                  `c${Math.round(initialUsd / 1000)}k`,
                  `d${Math.round(demandUsd / 1_000_000)}m`,
                  sellMode.id,
                ].join("_");

                const lbpConfig: LBPConfig = normalizeWeights({
                  ...baseCfg,
                  tknWeightIn: startWeightTknPct,
                  usdcWeightIn: 100 - startWeightTknPct,
                  tknWeightOut: endWeightTknPct,
                  usdcWeightOut: 100 - endWeightTknPct,
                  usdcBalanceIn: initialUsd,
                  swapFee: swapFeePct,
                  duration: 72,
                });

                const snapshots = runDeterministicSimulation(
                  lbpConfig,
                  demandConfig,
                  sellMode.sell,
                  steps,
                );

                const summary = summarizeSnapshots(snapshots);
                const swaps = estimateSwapEvents(
                  snapshots,
                  lbpConfig.collateralToken,
                  ASSUMED_ETH_USD,
                );

                summaries.push({
                  ScenarioId: scenarioId,
                  Token: lbpConfig.tokenSymbol,
                  DurationHours: lbpConfig.duration,
                  Steps: steps,
                  StartWeightTknPct: startWeightTknPct,
                  EndWeightTknPct: endWeightTknPct,
                  SwapFeePct: swapFeePct,
                  InitialCollateralUsd: initialUsd,
                  DemandEndCumulativeUsd: estimateEndCumulativeBuys(demandConfig),
                  SellBehavior: sellMode.id,
                  InitialPriceUsd: summary.initialPrice,
                  MinPriceUsd: summary.minPrice,
                  FinalPriceUsd: summary.finalPrice,
                  NetRaisedUsd: summary.netRaised,
                  EstSwaps: swaps.estTotal,
                  CommunityHeld: summary.communityHeld,
                  CommunityAvgCostUsd: summary.communityAvgCost,
                });
              }
            }
          }
        }
      }

      const byRaised = [...summaries].sort(
        (a, b) => Number(b.NetRaisedUsd ?? 0) - Number(a.NetRaisedUsd ?? 0),
      );
      const topRaised = byRaised.slice(0, 10);
      const bottomRaised = byRaised.slice(-10).reverse();

      // eslint-disable-next-line no-console
      console.log("[Nerite sweep] Top net raised:");
      // eslint-disable-next-line no-console
      console.table(topRaised);

      // eslint-disable-next-line no-console
      console.log("[Nerite sweep] Bottom net raised:");
      // eslint-disable-next-line no-console
      console.table(bottomRaised);

      if (process.env.EXPORT_CSV === "1") {
        const now = new Date();
        const stamp = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
          String(now.getHours()).padStart(2, "0"),
          String(now.getMinutes()).padStart(2, "0"),
          String(now.getSeconds()).padStart(2, "0"),
        ].join("");
        const outPath = path.resolve(process.cwd(), `out/nerite-sweep-${stamp}.csv`);
        writeCsvFile(outPath, byRaised);
        // eslint-disable-next-line no-console
        console.log(`[Nerite sweep] CSV exported: ${outPath}`);
      }

      if (process.env.EXPORT_XLSX === "1") {
        const now = new Date();
        const stamp = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
          String(now.getHours()).padStart(2, "0"),
          String(now.getMinutes()).padStart(2, "0"),
          String(now.getSeconds()).padStart(2, "0"),
        ].join("");
        const outPath = path.resolve(process.cwd(), `out/nerite-sweep-${stamp}.xlsx`);
        writeXlsxFile(outPath, byRaised);
        // eslint-disable-next-line no-console
        console.log(`[Nerite sweep] XLSX exported: ${outPath}`);
      }
    },
  );
});

describe("Nerite FDV target curve", () => {
  it("matches ~500k -> ~200k FDV (no-trades curve)", () => {
    const filePath = path.resolve(process.cwd(), "scenarios/nerite.json");
    if (!fs.existsSync(filePath)) return;

    const raw = fs.readFileSync(filePath, "utf8");
    const scenario = JSON.parse(raw) as ScenarioFile;

    const caseId = "fdv-500k-200k";
    const c = scenario.cases?.find((x) => x.id === caseId);
    if (!c) {
      throw new Error(`Expected nerite.json to include case id=${caseId}`);
    }

    const { steps, lbpConfig, demandConfig, sellConfig } = mergeCase(
      scenario.base,
      c.overrides,
    );

    const snapshots = runDeterministicSimulation(lbpConfig, demandConfig, sellConfig, steps);
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];

    const totalSupply = lbpConfig.totalSupply;
    const initialFdvUsd = (first?.price ?? 0) * totalSupply;
    const finalFdvUsd = (last?.price ?? 0) * totalSupply;

    expect(initialFdvUsd).toBeGreaterThan(450_000);
    expect(initialFdvUsd).toBeLessThan(550_000);
    expect(finalFdvUsd).toBeGreaterThan(180_000);
    expect(finalFdvUsd).toBeLessThan(220_000);
  });
});

const RUN_NERITE_OPT_SWEEP = process.env.RUN_NERITE_OPT_SWEEP === "1";
const neriteOptIt = RUN_NERITE_OPT_SWEEP ? it : it.skip;

describe("Nerite optimization sweep (FDV + early fair price)", () => {
  neriteOptIt(
    "searches feasible weight curves for ~200k FDV final and early fair price",
    { timeout: 60_000 },
    () => {
      const filePath = path.resolve(process.cwd(), "scenarios/nerite.json");
      if (!fs.existsSync(filePath)) return;

      const raw = fs.readFileSync(filePath, "utf8");
      const scenario = JSON.parse(raw) as ScenarioFile;

      const base = scenario.base;
      const steps = base.steps ?? 720;
      const baseCfg = normalizeWeights(base.lbpConfig);
      const baseDemand = base.demandConfig;

      if (baseCfg.collateralToken !== "USDC" && baseCfg.collateralToken !== "USDT") {
        throw new Error(
          `Nerite optimization expects stable collateral (USDC/USDT). Got: ${baseCfg.collateralToken}`,
        );
      }

      const durationHours = 72;
      const fairPriceUsd = 0.002;
      const targetFdvUsd = 200_000;
      const totalSupply = baseCfg.totalSupply;
      const tknBalanceIn = baseCfg.tknBalanceIn;

      const BUY_ONLY_SELL_CONFIG: SellPressureConfig = {
        preset: "loyal",
        loyalSoldPct: 0,
        loyalConcentrationPct: 60,
        greedySpreadPct: 2,
        greedySellPct: 0,
      };

      const weightCurves: Array<{ id: string; start: number; end: number }> = [
        { id: "w98to10", start: 98, end: 10 }, // 98/2 -> 10/90
        { id: "w90to10", start: 90, end: 10 }, // 90/10 -> 10/90
        { id: "w90to25", start: 90, end: 25 }, // 90/10 -> 25/75
      ];

      // Feasible initial collateral ranges (seed collateral is a major realism knob).
      const initialCollateralUsd = [
        5_000,
        7_500,
        10_000,
        15_000,
        20_000,
        30_000,
        50_000,
        75_000,
        100_000,
        250_000,
      ];
      const swapFeesPct = [1, 2, 3];
      const demandPresets: Array<DemandPressureConfig["preset"]> = ["bearish", "bullish"];
      const demandBudgetsUsd = [
        0,
        5_000,
        10_000,
        15_000,
        20_000,
        25_000,
        30_000,
        40_000,
        50_000,
        75_000,
        100_000,
        150_000,
        200_000,
        250_000,
        500_000,
        1_000_000,
        2_000_000,
        5_000_000,
        10_000_000,
      ];

      const elasticities = [0, 1, 2];
      const refMultipliers = [0.2, 0.3, 0.4];

      const weightAtProgress = (start: number, end: number, p: number) => start + (end - start) * p;
      const ratioToWeightPct = (ratio: number) => (100 * ratio) / (1 + ratio); // ratio = Wtkn/Wusdc

      const estimateNoTradeFairHour = (start: number, end: number, usdcIn: number) => {
        if (!(usdcIn > 0)) return Number.POSITIVE_INFINITY;
        const k = usdcIn / tknBalanceIn; // Busdc/Btkn
        const targetRatio = fairPriceUsd / k; // = Wtkn/Wusdc at fair price (no trades)
        const targetWtkn = ratioToWeightPct(targetRatio);
        const denom = end - start;
        if (denom === 0) return Number.POSITIVE_INFINITY;
        const p = (targetWtkn - start) / denom;
        if (!Number.isFinite(p) || p < 0 || p > 1) return Number.POSITIVE_INFINITY;
        return p * durationHours;
      };

      const hoursToPriceAtOrBelow = (snapshots: any[], priceUsd: number) => {
        const target = priceUsd * 1.01; // allow small numeric wiggle
        for (const s of snapshots) {
          if (Number.isFinite(s.price) && s.price <= target) return Number(s.time ?? 0);
        }
        return Number.POSITIVE_INFINITY;
      };

      const pctStepsAtOrBelow = (snapshots: any[], priceUsd: number) => {
        if (!snapshots.length) return 0;
        const target = priceUsd;
        let count = 0;
        for (const s of snapshots) {
          if (Number.isFinite(s.price) && s.price <= target) count++;
        }
        return count / snapshots.length;
      };

      type OptRow = {
        ScenarioId: string;
        Curve: string;
        NoTradeFairHour: number;
        SwapFeePct: number;
        DemandPreset: DemandPressureConfig["preset"];
        DemandBudgetUsd: number;
        PriceElasticity: number;
        RefMult: number;
        InitialCollateralUsd: number;
        InitialPriceUsd: number;
        HoursToFair: number;
        PctStepsWithBuys: number;
        PctStepsBelowFair: number;
        PctStepsInFdvBand200to500: number;
        HoursInFdvBand200to500: number;
        MinPriceUsd: number;
        MaxPriceUsd: number;
        FinalPriceUsd: number;
        MaxFdvUsd: number;
        FinalFdvUsd: number;
        FinalFdvErrorPct: number;
        NetRaisedUsd: number;
        TotalBuysUsd: number;
        Score: number;
      };

      const rows: OptRow[] = [];

      for (const curve of weightCurves) {
        for (const usdcIn of initialCollateralUsd) {
          const noTradeFairHour = estimateNoTradeFairHour(curve.start, curve.end, usdcIn);
          // Focus: scenarios where the weights alone would reach fair within ~12h (otherwise it can't be "early").
          if (!Number.isFinite(noTradeFairHour) || noTradeFairHour > 12) continue;
          const curveDemandBudgetsUsd =
            curve.id === "w98to10"
              ? demandBudgetsUsd
              : demandBudgetsUsd.filter((b) => b <= 500_000);

          for (const swapFeePct of swapFeesPct) {
            for (const demandPreset of demandPresets) {
              const endScale = demandPreset === "bearish" ? 0.35 : 1.0;

              for (const demandBudgetUsd of curveDemandBudgetsUsd) {
                const curveElasticities = curve.id === "w98to10" ? [0, 1, 2, 3, 4] : elasticities;
                const curveRefMultipliers =
                  curve.id === "w98to10" ? [0.05, 0.1, 0.2, 0.3, 0.4] : refMultipliers;

                for (const priceElasticity of curveElasticities) {
                  for (const refMult of curveRefMultipliers) {
                    const magnitudeBase = pickMagnitudeBaseForTarget(demandBudgetUsd / endScale);
                    const demandConfig: DemandPressureConfig = {
                      ...baseDemand,
                      preset: demandPreset,
                      magnitudeBase,
                      multiplier: demandBudgetUsd === 0 ? 0 : (demandBudgetUsd / endScale) / magnitudeBase,
                      priceElasticity,
                      priceElasticityDirection: "symmetric",
                      priceElasticityReferenceMultiplier: refMult,
                      priceElasticityExecutionModel: "backlog",
                      priceElasticityBacklogMaxSpendMultiplier: 5,
                    };

                    const scenarioId = [
                      "nerite",
                      curve.id,
                      `c${Math.round(usdcIn / 1000)}k`,
                      `fee${swapFeePct}`,
                      `d${Math.round(demandBudgetUsd / 1000)}k`,
                      demandPreset,
                      `el${priceElasticity}`,
                      `ref${String(refMult).replace(".", "_")}`,
                    ].join("_");

                    const lbpConfig: LBPConfig = normalizeWeights({
                      ...baseCfg,
                      duration: durationHours,
                      swapFee: swapFeePct,
                      tknWeightIn: curve.start,
                      usdcWeightIn: 100 - curve.start,
                      tknWeightOut: curve.end,
                      usdcWeightOut: 100 - curve.end,
                      usdcBalanceIn: usdcIn,
                    });

                    const snapshots = runDeterministicSimulation(
                      lbpConfig,
                      demandConfig,
                      BUY_ONLY_SELL_CONFIG,
                      steps,
                    );

                    const summary = summarizeSnapshots(snapshots);
                    const hoursToFair = hoursToPriceAtOrBelow(snapshots, fairPriceUsd);
                    const pctBelow = pctStepsAtOrBelow(snapshots, fairPriceUsd);

                    let buySteps = 0;
                    let inBandSteps = 0;
                    let maxFdvUsd = 0;
                    const fdvBandLo = 200_000;
                    const fdvBandHi = 500_000;
                    for (const s of snapshots) {
                      if ((s.buyVolumeUSDC ?? 0) > 0) buySteps++;
                      const price = Number(s.price ?? 0);
                      if (Number.isFinite(price) && price >= 0) {
                        const fdv = price * totalSupply;
                        maxFdvUsd = Math.max(maxFdvUsd, fdv);
                        if (fdv >= fdvBandLo && fdv <= fdvBandHi) inBandSteps++;
                      }
                    }
                    const pctStepsWithBuys = snapshots.length ? buySteps / snapshots.length : 0;
                    const pctStepsInFdvBand200to500 = snapshots.length
                      ? inBandSteps / snapshots.length
                      : 0;
                    const hoursInFdvBand200to500 = pctStepsInFdvBand200to500 * durationHours;

                    const finalFdvUsd = Number(summary.finalPrice ?? 0) * totalSupply;
                    const finalFdvErrorPct =
                      targetFdvUsd > 0
                        ? (Math.abs(finalFdvUsd - targetFdvUsd) / targetFdvUsd) * 100
                        : 0;

                    // Score: prioritize FDV accuracy, then hitting fair early and sustaining buys.
                    let score = finalFdvErrorPct * 5 + hoursToFair * 2;
                    if (!Number.isFinite(hoursToFair) || hoursToFair > 12) score += 500;
                    if (finalFdvErrorPct > 15) score += 300;
                    if (pctStepsWithBuys < 0.35 && demandBudgetUsd > 0) score += 25;
                    if (Number(summary.minPrice ?? 0) < fairPriceUsd / 10) score += 25;

                    rows.push({
                      ScenarioId: scenarioId,
                      Curve: `${curve.start}/${100 - curve.start} -> ${curve.end}/${100 - curve.end}`,
                      NoTradeFairHour: noTradeFairHour,
                      SwapFeePct: swapFeePct,
                      DemandPreset: demandPreset,
                      DemandBudgetUsd: demandBudgetUsd,
                      PriceElasticity: priceElasticity,
                      RefMult: refMult,
                      InitialCollateralUsd: usdcIn,
                      InitialPriceUsd: Number(summary.initialPrice ?? 0),
                      HoursToFair: hoursToFair,
                      PctStepsWithBuys: pctStepsWithBuys,
                      PctStepsBelowFair: pctBelow,
                      PctStepsInFdvBand200to500: pctStepsInFdvBand200to500,
                      HoursInFdvBand200to500: hoursInFdvBand200to500,
                      MinPriceUsd: Number(summary.minPrice ?? 0),
                      MaxPriceUsd: Number(summary.maxPrice ?? 0),
                      FinalPriceUsd: Number(summary.finalPrice ?? 0),
                      MaxFdvUsd: maxFdvUsd,
                      FinalFdvUsd: finalFdvUsd,
                      FinalFdvErrorPct: finalFdvErrorPct,
                      NetRaisedUsd: Number(summary.netRaised ?? 0),
                      TotalBuysUsd: Number(summary.totalBuys ?? 0),
                      Score: score,
                    });
                  }
                }
              }
            }
          }
        }
      }

      const sorted = [...rows].sort((a, b) => a.Score - b.Score);
      const top10FastFairPrimary = [...rows]
        .filter(
          (r) =>
            r.DemandBudgetUsd > 0 &&
            r.FinalFdvUsd >= 150_000 &&
            r.FinalFdvUsd <= 500_000 &&
            Number.isFinite(r.HoursToFair),
        )
        .sort((a, b) => a.HoursToFair - b.HoursToFair)
        .slice(0, 10);
      const top10FastFairFallback = [...rows]
        .filter((r) => Number.isFinite(r.HoursToFair))
        .sort((a, b) => a.HoursToFair - b.HoursToFair)
        .slice(0, 10);
      const top10FastFair = top10FastFairPrimary.length ? top10FastFairPrimary : top10FastFairFallback;

      const top10MaxFdvPrimary = [...rows]
        .filter((r) => r.DemandBudgetUsd > 0)
        .sort((a, b) => b.MaxFdvUsd - a.MaxFdvUsd)
        .slice(0, 10);
      const top10MaxFdv = top10MaxFdvPrimary.length
        ? top10MaxFdvPrimary
        : [...rows].sort((a, b) => b.MaxFdvUsd - a.MaxFdvUsd).slice(0, 10);

      const top10BandTimePrimary = [...rows]
        .filter((r) => r.PctStepsInFdvBand200to500 > 0)
        .sort((a, b) => b.HoursInFdvBand200to500 - a.HoursInFdvBand200to500)
        .slice(0, 10);
      const top10BandTime = top10BandTimePrimary.length
        ? top10BandTimePrimary
        : [...rows]
            .sort((a, b) => b.HoursInFdvBand200to500 - a.HoursInFdvBand200to500)
            .slice(0, 10);

      const eligible = sorted.filter(
        (r) => r.FinalFdvErrorPct <= 10 && Number.isFinite(r.HoursToFair) && r.HoursToFair <= 12,
      );
      const pool = eligible.length >= 3 ? eligible : sorted;
      const top3: OptRow[] = [];
      const seen = new Set<string>();
      for (const r of pool) {
        const key = [
          r.Curve,
          r.InitialCollateralUsd,
          r.SwapFeePct,
          r.DemandPreset,
          r.DemandBudgetUsd,
        ].join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        top3.push(r);
        if (top3.length >= 3) break;
      }

      // eslint-disable-next-line no-console
      console.log("[Nerite opt] Top 3 by score (FDV accuracy + early fair):");
      // eslint-disable-next-line no-console
      console.table(
        top3.map((r) => ({
          ScenarioId: r.ScenarioId,
          Curve: r.Curve,
          NoTradeFairHour: Number.isFinite(r.NoTradeFairHour)
            ? Number(r.NoTradeFairHour.toFixed(2))
            : Infinity,
          SwapFeePct: r.SwapFeePct,
          DemandPreset: r.DemandPreset,
          DemandBudgetUsd: Math.round(r.DemandBudgetUsd),
          Elasticity: r.PriceElasticity,
          RefMult: r.RefMult,
          InitialPriceUsd: r.InitialPriceUsd,
          HoursToFair: r.HoursToFair,
          PctStepsWithBuys: Number((r.PctStepsWithBuys * 100).toFixed(1)),
          FinalFdvUsd: Math.round(r.FinalFdvUsd),
          FinalFdvErrorPct: Number(r.FinalFdvErrorPct.toFixed(2)),
          NetRaisedUsd: Math.round(r.NetRaisedUsd),
          PctStepsBelowFair: Number((r.PctStepsBelowFair * 100).toFixed(1)),
        })),
      );

      // eslint-disable-next-line no-console
      console.log("[Nerite opt] Top 10 fastest time-to-fair ($0.002):");
      // eslint-disable-next-line no-console
      console.table(
        top10FastFair.map((r) => ({
          ScenarioId: r.ScenarioId,
          Curve: r.Curve,
          HoursToFair: Number(r.HoursToFair.toFixed(2)),
          InitialPriceUsd: r.InitialPriceUsd,
          FinalFdvUsd: Math.round(r.FinalFdvUsd),
          FinalFdvErrorPct: Number(r.FinalFdvErrorPct.toFixed(2)),
          NetRaisedUsd: Math.round(r.NetRaisedUsd),
        })),
      );

      // eslint-disable-next-line no-console
      console.log("[Nerite opt] Top 10 highest FDV (max over LBP):");
      // eslint-disable-next-line no-console
      console.table(
        top10MaxFdv.map((r) => ({
          ScenarioId: r.ScenarioId,
          Curve: r.Curve,
          MaxFdvUsd: Math.round(r.MaxFdvUsd),
          MaxPriceUsd: r.MaxPriceUsd,
          FinalFdvUsd: Math.round(r.FinalFdvUsd),
          HoursToFair: Number.isFinite(r.HoursToFair) ? Number(r.HoursToFair.toFixed(2)) : Infinity,
        })),
      );

      // eslint-disable-next-line no-console
      console.log("[Nerite opt] Top 10 longest time in FDV band ($500k..$200k):");
      // eslint-disable-next-line no-console
      console.table(
        top10BandTime.map((r) => ({
          ScenarioId: r.ScenarioId,
          Curve: r.Curve,
          HoursInBand: Number(r.HoursInFdvBand200to500.toFixed(2)),
          PctStepsInBand: Number((r.PctStepsInFdvBand200to500 * 100).toFixed(1)),
          FinalFdvUsd: Math.round(r.FinalFdvUsd),
          HoursToFair: Number.isFinite(r.HoursToFair) ? Number(r.HoursToFair.toFixed(2)) : Infinity,
        })),
      );

      if (process.env.EXPORT_NERITE_OPT_XLSX === "1") {
        const now = new Date();
        const stamp = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
          String(now.getHours()).padStart(2, "0"),
          String(now.getMinutes()).padStart(2, "0"),
          String(now.getSeconds()).padStart(2, "0"),
        ].join("");
        const outPath = path.resolve(process.cwd(), `out/nerite-opt-${stamp}.xlsx`);
        const sheets = [
          { name: "All Runs", rows: sorted },
          { name: "Top 3", rows: top3 },
          { name: "Top 10 - TimeToFair", rows: top10FastFair },
          { name: "Top 10 - MaxFDV", rows: top10MaxFdv },
          { name: "Top 10 - Band200-500", rows: top10BandTime },
        ];
        writeXlsxWorkbook(outPath, sheets);
        const latestPath = path.resolve(process.cwd(), "out/nerite-opt-latest.xlsx");
        writeXlsxWorkbook(latestPath, sheets);
        // eslint-disable-next-line no-console
        console.log(`[Nerite opt] XLSX exported: ${outPath}`);
        // eslint-disable-next-line no-console
        console.log(`[Nerite opt] XLSX exported (latest): ${latestPath}`);
      }
    },
  );
});
