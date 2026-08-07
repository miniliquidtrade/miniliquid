import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract a human message from anything a wallet / HL / JS can throw.
 * Wallet providers often reject with a plain object ({ code, message, … })
 * rather than an Error, which naively stringifies to "[object Object]".
 */
export function errMsg(e: unknown): string {
  if (e == null) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const nested =
      (o.error as { message?: string } | undefined)?.message ??
      (o.data as { message?: string } | undefined)?.message ??
      (o.cause as { message?: string } | undefined)?.message;
    const m = (o.message as string) ?? (o.reason as string) ?? nested;
    if (typeof m === "string" && m) return m;
    if (o.code != null) return `Error ${String(o.code)}`;
    try {
      return JSON.stringify(o);
    } catch {
      return "Unknown error";
    }
  }
  return String(e);
}

/** Adaptive price formatting: more decimals for small numbers. */
export function fmtPrice(px: number): string {
  if (!isFinite(px) || px === 0) return "—";
  if (px >= 1000) return px.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (px >= 1) return px.toLocaleString("en-US", { maximumFractionDigits: 3 });
  if (px >= 0.01) return px.toFixed(4);
  return px.toPrecision(4);
}

/** Compact USD for volume / open interest: 1.2B, 34.5M, 890K. */
export function fmtCompact(n: number): string {
  if (!isFinite(n) || n === 0) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

/** Coin/token size — adaptive decimals (never rounds small sizes to 0). */
export function fmtSize(n: number): string {
  const a = Math.abs(n);
  if (a === 0) return "0";
  if (a >= 1000) return fmtCompact(n);
  if (a >= 1) return n.toFixed(3).replace(/\.?0+$/, "");
  if (a >= 0.001) return n.toFixed(5).replace(/\.?0+$/, "");
  return n.toPrecision(3);
}

/**
 * Estimated liquidation price for a fresh isolated position.
 * Uses HL's maintenance-margin fraction ≈ 1/(2·maxLeverage). This is an
 * estimate — real cross-margin liquidation also depends on the rest of the
 * account — so label it "est.".
 */
export function estLiqPrice(
  entry: number,
  leverage: number,
  maxLeverage: number,
  isLong: boolean
): number {
  if (!entry || entry <= 0) return 0;
  const L = Math.max(1, leverage);
  const mmf = 1 / (2 * Math.max(1, maxLeverage));
  const liq = isLong
    ? (entry * (1 - 1 / L)) / (1 - mmf)
    : (entry * (1 + 1 / L)) / (1 + mmf);
  return Math.max(0, liq);
}

/** Signed percentage, 2 decimals. */
export function fmtPct(p: number): string {
  if (!isFinite(p)) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

/** Funding rate is per-hour; show as annualized-ish hourly % with sign. */
export function fmtFunding(f: number): string {
  if (!isFinite(f)) return "—";
  const pct = f * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(4)}%`;
}

/**
 * Funding in plain language. Hyperliquid charges funding every hour; a
 * positive rate means longs pay shorts (and vice-versa). Returns the hourly
 * rate, an annualized figure (24 × 365), and which side pays — so the UI can
 * say "Longs pay 0.011%/hr (~96%/yr)" instead of a bare signed number.
 */
export function fundingInfo(f: number): {
  hourlyPct: number;
  annualPct: number;
  payer: "long" | "short" | null;
  label: string;
} {
  const safe = isFinite(f) ? f : 0;
  const hourlyPct = safe * 100;
  const annualPct = safe * 24 * 365 * 100;
  const payer = safe > 0 ? "long" : safe < 0 ? "short" : null;
  const label =
    payer === "long"
      ? "Longs pay shorts"
      : payer === "short"
      ? "Shorts pay longs"
      : "Flat";
  return { hourlyPct, annualPct, payer, label };
}
