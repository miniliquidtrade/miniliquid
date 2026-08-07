// Minimal read-only Hyperliquid info client.
// Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint

export const HL_API = "https://api.hyperliquid.xyz";

async function info<T = unknown>(body: object): Promise<T> {
  const res = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HL API ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface AssetCtx {
  markPx: string;
  midPx?: string;
  prevDayPx: string;
  dayNtlVlm: string;
  funding: string;
  openInterest: string;
  oraclePx: string;
}

export interface UniverseAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  /** Some assets (often newer / lower-liquidity) support isolated margin only. */
  onlyIsolated?: boolean;
}

export interface Meta {
  universe: UniverseAsset[];
}

export interface PerpDex {
  name: string;
  full_name?: string;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export const getAllMids = () => info<Record<string, string>>({ type: "allMids" });

export const getPerpDexs = () => info<(PerpDex | null)[]>({ type: "perpDexs" });

export const getMetaAndAssetCtxs = (dex?: string) =>
  info<[Meta, AssetCtx[]]>(
    dex ? { type: "metaAndAssetCtxs", dex } : { type: "metaAndAssetCtxs" }
  );

export interface Candle {
  t: number; // open time (ms)
  T: number; // close time (ms)
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

export const getCandles = (coin: string, interval: string, startTime: number) =>
  info<Candle[]>({
    type: "candleSnapshot",
    req: { coin, interval, startTime, endTime: Date.now() },
  });

export interface L2Level {
  px: string;
  sz: string;
  n: number;
}
export interface L2Book {
  coin: string;
  levels: [L2Level[], L2Level[]]; // [bids, asks]
  time: number;
}

export const getOrderbook = (coin: string) =>
  info<L2Book>({ type: "l2Book", coin });

// ── Account state (per connected wallet) ─────────────────────────────────────

export interface Position {
  coin: string;
  szi: string; // signed size; >0 long, <0 short
  entryPx: string | null;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  leverage: { type: string; value: number };
  marginUsed: string;
}

export interface ClearinghouseState {
  marginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
  };
  withdrawable: string;
  assetPositions: { position: Position }[];
}

export const getClearinghouseState = (user: string, dex?: string) =>
  info<ClearinghouseState>(
    dex
      ? { type: "clearinghouseState", user, dex }
      : { type: "clearinghouseState", user }
  );

/**
 * The combined state the official HL frontend uses. Unlike the plain perp
 * clearinghouseState, this reliably contains open positions for unified /
 * portfolio-margin accounts too. Shape is large & version-dependent, so we
 * treat it as unknown and scan it for positions.
 */
export const getWebData2 = (user: string) =>
  info<unknown>({ type: "webData2", user });

export interface SpotBalance {
  coin: string;
  total: string;
  hold: string;
}
export const getSpotState = (user: string) =>
  info<{ balances: SpotBalance[] }>({ type: "spotClearinghouseState", user });

/** Portfolio time-series: [ [period, { accountValueHistory, pnlHistory }], … ] */
export type PortfolioWindow = [
  string,
  {
    accountValueHistory: [number, string][];
    pnlHistory: [number, string][];
  }
];
export const getPortfolio = (user: string) =>
  info<PortfolioWindow[]>({ type: "portfolio", user });

export const getOpenOrders = (user: string) =>
  info<
    {
      coin: string;
      side: string;
      limitPx: string;
      sz: string;
      oid: number;
      timestamp: number;
      orderType?: string;
      triggerPx?: string;
    }[]
  >({ type: "openOrders", user });

/** A single trade fill. `dir` e.g. "Open Long"/"Close Short"; closedPnl is the
 * realized P&L on closes; fee is Hyperliquid's protocol fee. */
export interface Fill {
  coin: string;
  px: string;
  sz: string;
  side: string;
  time: number;
  dir: string;
  closedPnl: string;
  /** Hyperliquid protocol fee for this fill (may be negative for rebates). */
  fee: string;
  feeToken?: string;
  hash: string;
  oid: number;
  tid?: number;
  /** Client order id we set at order time — carries the encoded leverage. */
  cloid?: string | null;
}
export const getUserFills = (user: string) =>
  info<Fill[]>({ type: "userFills", user });
