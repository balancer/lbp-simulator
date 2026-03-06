import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

const SUBSCRIPT_DIGITS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

function toSubscriptNumber(n: number) {
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.floor(n))
    .split("")
    .map((ch) => SUBSCRIPT_DIGITS[ch] ?? ch)
    .join("");
}

function trimTrailingZeros(s: string) {
  if (!s.includes(".")) return s;
  return s.replace(/(?:\.0+|(\.\d+?)0+)$/, "$1");
}

type FormatPriceOptions = {
  currencySymbol?: string;
  /** For abs(value) below this, use the compact 0.0ₙ123 style. */
  tinyCutoff?: number;
  /** Significant digits shown after the 0.0ₙ prefix (e.g. 3 => "112"). */
  tinySigDigits?: number;
};

/**
 * Formats a USD-ish price for display, including very small values.
 *
 * For very small values (default: < 1e-4), uses a compact representation:
 *   0.0₅112  => 0.00000112 (5 leading zeros after the decimal)
 *
 * This uses Unicode subscripts so it works in charts/tooltips as plain text.
 */
export function formatPrice(value: number, opts: FormatPriceOptions = {}) {
  const currencySymbol = opts.currencySymbol ?? "$";
  const tinyCutoff =
    typeof opts.tinyCutoff === "number" && opts.tinyCutoff > 0
      ? opts.tinyCutoff
      : 1e-4;
  const tinySigDigits =
    typeof opts.tinySigDigits === "number" && opts.tinySigDigits >= 2
      ? Math.floor(opts.tinySigDigits)
      : 3;

  if (!Number.isFinite(value)) return `${currencySymbol}${String(value)}`;

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs === 0) return `${currencySymbol}0`;

  // Normal range: keep existing feel (2 decimals for >= 1, more detail for < 1).
  if (abs >= 1) {
    return `${sign}${currencySymbol}${abs.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (abs >= 0.01) {
    return `${sign}${currencySymbol}${trimTrailingZeros(abs.toFixed(4))}`;
  }

  if (abs >= tinyCutoff) {
    return `${sign}${currencySymbol}${trimTrailingZeros(abs.toFixed(6))}`;
  }

  // Tiny: 0.0ₙXYZ style.
  const zeros = Math.max(0, Math.ceil(-Math.log10(abs)) - 1);
  const scalePow = zeros + 1;
  let scaled = abs * 10 ** scalePow; // ~ [1, 10)
  let digitsStr = scaled.toFixed(tinySigDigits - 1).replace(".", "");
  if (digitsStr.startsWith("10")) {
    // Handle rounding that pushes 9.99.. -> 10.00, which effectively reduces zero count by 1.
    const nextZeros = Math.max(0, zeros - 1);
    scaled = abs * 10 ** (nextZeros + 1);
    digitsStr = scaled.toFixed(tinySigDigits - 1).replace(".", "");
    return `${sign}${currencySymbol}0.0${toSubscriptNumber(nextZeros)}${digitsStr}`;
  }

  return `${sign}${currencySymbol}0.0${toSubscriptNumber(zeros)}${digitsStr}`;
}
