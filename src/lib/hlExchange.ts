// Hyperliquid exchange (write) actions.
//
// Signing infrastructure is copied from the proven implementation:
//  - L1 actions (orders, leverage) use the "Agent" EIP-712 type with a
//    keccak256(msgpack(action) + nonce + 0x00) connectionId.
//  - User-signed actions (transfers) use per-action EIP-712 types under the
//    "HyperliquidSignTransaction" domain.
//
// Orders are sent straight to the exchange.

import { HL_API } from "./hl";

// Leverage travels with the trade via the client order id (cloid): HL echoes
// the cloid back on the fill (userFills), so any device can read the leverage
// of a closed trade — no server or per-device cache needed. Layout of the
// 16-byte cloid: "ML" marker (0x4d4c) · leverage byte · 13 random bytes.
function leverageCloid(lev: number): `0x${string}` {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[0] = 0x4d; // M
  b[1] = 0x4c; // L
  b[2] = Math.max(1, Math.min(255, Math.round(lev || 1)));
  let hex = "";
  for (let i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, "0");
  return `0x${hex}`;
}

/** Read the leverage back out of a Miniliquid-stamped cloid, if present. */
export function decodeLeverageCloid(cloid?: string | null): number | undefined {
  if (!cloid) return undefined;
  const h = cloid.toLowerCase().replace(/^0x/, "");
  if (h.length < 6 || h.slice(0, 4) !== "4d4c") return undefined;
  const lev = parseInt(h.slice(4, 6), 16);
  return lev > 0 ? lev : undefined;
}

export type WalletClient = {
  account: { address: string };
  signTypedData: (args: {
    domain: object;
    types: object;
    primaryType: string;
    message: object;
  }) => Promise<string>;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function splitSig(sig: string) {
  const r = sig.slice(0, 66);
  const s = `0x${sig.slice(66, 130)}`;
  let v = parseInt(sig.slice(130, 132), 16);
  if (v === 0 || v === 1) v += 27;
  return { r, s, v };
}

async function postExchange(body: object) {
  const res = await fetch(`${HL_API}/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: { status?: string; response?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (parsed?.status === "err") {
    const msg =
      typeof parsed.response === "string"
        ? parsed.response
        : JSON.stringify(parsed.response);
    throw new Error(msg);
  }
  // Also surface per-order errors nested in a successful envelope.
  const statuses = (
    parsed as { response?: { data?: { statuses?: unknown[] } } }
  )?.response?.data?.statuses;
  if (Array.isArray(statuses)) {
    const err = statuses.find(
      (s): s is { error: string } =>
        typeof s === "object" && s !== null && "error" in s
    );
    if (err) throw new Error(err.error);
  }
  return parsed;
}

async function computeL1ActionHash(
  action: object,
  nonce: number
): Promise<`0x${string}`> {
  const { keccak256 } = await import("viem");
  const { encode } = await import("@msgpack/msgpack");
  const msgpackBytes = encode(action);
  const combined = new Uint8Array(msgpackBytes.length + 9);
  combined.set(msgpackBytes);
  new DataView(combined.buffer).setBigUint64(
    msgpackBytes.length,
    BigInt(nonce),
    false
  );
  combined[msgpackBytes.length + 8] = 0; // vaultAddress = null marker
  return keccak256(combined);
}

async function signL1Action(
  walletClient: WalletClient,
  action: object,
  nonce: number
) {
  const connectionId = await computeL1ActionHash(action, nonce);
  const sig = await walletClient.signTypedData({
    domain: {
      name: "Exchange",
      version: "1",
      // L1 actions use the fixed phantom chainId 1337 (NOT the real chain).
      // Mainnet vs testnet is distinguished by the phantom-agent `source`
      // ("a" = mainnet) below, not by this chainId.
      chainId: 1337,
      verifyingContract: ZERO_ADDRESS,
    },
    types: {
      Agent: [
        { name: "source", type: "string" },
        { name: "connectionId", type: "bytes32" },
      ],
    },
    primaryType: "Agent",
    message: { source: "a", connectionId },
  });
  return postExchange({
    action,
    nonce,
    signature: splitSig(sig),
    vaultAddress: null,
  });
}

async function signUserAction(
  walletClient: WalletClient,
  actionFields: Record<string, unknown>,
  type: string,
  eip712Types: Record<string, { name: string; type: string }[]>
) {
  const nonce = Date.now();
  const fullAction = {
    type,
    signatureChainId: "0xa4b1", // Arbitrum One
    hyperliquidChain: "Mainnet",
    ...actionFields,
    nonce,
  };
  const primaryType = Object.keys(eip712Types)[0];
  const knownKeys = new Set(eip712Types[primaryType].map((f) => f.name));
  const message = Object.fromEntries(
    Object.entries(fullAction).filter(([k]) => knownKeys.has(k))
  );
  const sig = await walletClient.signTypedData({
    domain: {
      name: "HyperliquidSignTransaction",
      version: "1",
      chainId: 42161,
      verifyingContract: ZERO_ADDRESS,
    },
    types: eip712Types,
    primaryType,
    message,
  });
  return postExchange({ action: fullAction, nonce, signature: splitSig(sig) });
}

// ── Price / size rounding to HL tick rules ───────────────────────────────────

/**
 * Round a price to HL's tick rules. A valid perp price has at most 5
 * significant figures AND at most (MAX_DECIMALS − szDecimals) decimal places,
 * where MAX_DECIMALS is 6 for perps. (Integer prices are always allowed and
 * pass both checks naturally.) Enforcing only the sig-fig rule — as before —
 * left fractional prices on higher-szDecimals assets with too many decimals,
 * which HL rejects as "Order has invalid price".
 */
const PERP_MAX_DECIMALS = 6;
function roundPx(px: number, szDecimals: number): string {
  const maxDecimals = Math.max(0, PERP_MAX_DECIMALS - szDecimals);
  const sigFigs = parseFloat(px.toPrecision(5));
  return parseFloat(sigFigs.toFixed(maxDecimals)).toString();
}
function roundSz(sz: number, szDecimals: number): string {
  return parseFloat(sz.toFixed(szDecimals)).toString();
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function updateLeverage(params: {
  walletClient: WalletClient;
  asset: number;
  leverage: number;
  isCross?: boolean;
}) {
  const { walletClient, asset, leverage, isCross = true } = params;
  return signL1Action(
    walletClient,
    { type: "updateLeverage", asset, isCross, leverage },
    Date.now()
  );
}

/**
 * Place a market order via an aggressive IOC limit.
 * `price` should be the current mark; we pad it to cross the spread.
 */
export async function marketOrder(params: {
  walletClient: WalletClient;
  asset: number;
  isBuy: boolean;
  size: number;
  price: number;
  szDecimals: number;
  leverage: number;
  isCross?: boolean;
  reduceOnly?: boolean;
  slippage?: number;
}) {
  const {
    walletClient,
    asset,
    isBuy,
    size,
    price,
    szDecimals,
    leverage,
    isCross = true,
    reduceOnly = false,
    slippage = 0.02,
  } = params;

  // Set the leverage AND margin mode first; nonce+1 guarantees ordering.
  const n0 = Date.now();
  await signL1Action(
    walletClient,
    { type: "updateLeverage", asset, isCross, leverage },
    n0
  );

  const padded = isBuy ? price * (1 + slippage) : price * (1 - slippage);
  const action = {
    type: "order",
    orders: [
      {
        a: asset,
        b: isBuy,
        p: roundPx(padded, szDecimals),
        s: roundSz(size, szDecimals),
        r: reduceOnly,
        t: { limit: { tif: "Ioc" } },
        c: leverageCloid(leverage),
      },
    ],
    grouping: "na",
  };
  return signL1Action(walletClient, action, n0 + 1);
}

/** Limit order (GTC by default). */
export async function limitOrder(params: {
  walletClient: WalletClient;
  asset: number;
  isBuy: boolean;
  size: number;
  price: number;
  szDecimals: number;
  leverage: number;
  reduceOnly?: boolean;
  tif?: "Gtc" | "Alo" | "Ioc";
}) {
  const {
    walletClient,
    asset,
    isBuy,
    size,
    price,
    szDecimals,
    leverage,
    reduceOnly = false,
    tif = "Gtc",
  } = params;

  const n0 = Date.now();
  await signL1Action(
    walletClient,
    { type: "updateLeverage", asset, isCross: true, leverage },
    n0
  );

  const action = {
    type: "order",
    orders: [
      {
        a: asset,
        b: isBuy,
        p: roundPx(price, szDecimals),
        s: roundSz(size, szDecimals),
        r: reduceOnly,
        t: { limit: { tif } },
        c: leverageCloid(leverage),
      },
    ],
    grouping: "na",
  };
  return signL1Action(walletClient, action, n0 + 1);
}

/** Close a position fully with a reduce-only IOC in the opposite direction. */
export async function closePosition(params: {
  walletClient: WalletClient;
  asset: number;
  isLong: boolean;
  size: number;
  price: number;
  szDecimals: number;
  leverage?: number;
  slippage?: number;
}) {
  const {
    walletClient,
    asset,
    isLong,
    size,
    price,
    szDecimals,
    leverage = 1,
    slippage = 0.03,
  } = params;
  const isBuy = !isLong; // close long => sell
  const padded = isBuy ? price * (1 + slippage) : price * (1 - slippage);
  const action = {
    type: "order",
    orders: [
      {
        a: asset,
        b: isBuy,
        p: roundPx(padded, szDecimals),
        s: roundSz(size, szDecimals),
        r: true,
        t: { limit: { tif: "Ioc" } },
        c: leverageCloid(leverage),
      },
    ],
    grouping: "na",
  };
  return signL1Action(walletClient, action, Date.now());
}

/**
 * Attach take-profit and/or stop-loss to an existing position.
 * Both are reduce-only trigger orders opposite to the position side.
 */
export async function placeTpSlOrders(params: {
  walletClient: WalletClient;
  asset: number;
  isLong: boolean;
  size: number;
  szDecimals: number;
  leverage?: number;
  tpPrice?: number;
  slPrice?: number;
}) {
  const {
    walletClient,
    asset,
    isLong,
    size,
    szDecimals,
    leverage = 1,
    tpPrice,
    slPrice,
  } = params;
  const isBuy = !isLong; // closing order is opposite the position
  const sz = roundSz(size, szDecimals);
  const orders: object[] = [];

  if (tpPrice && tpPrice > 0) {
    const px = roundPx(tpPrice, szDecimals);
    orders.push({
      a: asset,
      b: isBuy,
      p: px,
      s: sz,
      r: true,
      t: { trigger: { isMarket: false, triggerPx: px, tpsl: "tp" } },
      c: leverageCloid(leverage),
    });
  }
  if (slPrice && slPrice > 0) {
    const trigPx = roundPx(slPrice, szDecimals);
    // Market stop: pad the limit so it fills through the trigger.
    const slipPx = roundPx(
      isLong ? slPrice * 0.97 : slPrice * 1.03,
      szDecimals
    );
    orders.push({
      a: asset,
      b: isBuy,
      p: slipPx,
      s: sz,
      r: true,
      t: { trigger: { triggerPx: trigPx, isMarket: true, tpsl: "sl" } },
      c: leverageCloid(leverage),
    });
  }

  if (!orders.length) return null;
  return signL1Action(
    walletClient,
    {
      type: "order",
      orders,
      grouping: orders.length === 2 ? "positionTpsl" : "na",
    },
    Date.now()
  );
}

export async function cancelOrder(params: {
  walletClient: WalletClient;
  asset: number;
  oid: number;
}) {
  const { walletClient, asset, oid } = params;
  return signL1Action(
    walletClient,
    { type: "cancel", cancels: [{ a: asset, o: oid }] },
    Date.now()
  );
}

/**
 * Approve an agent (API) wallet so it can sign trades on the master's behalf.
 * MUST be signed by the master wallet. Agents can trade but never withdraw.
 * `agentName` is "" for an unnamed agent (one allowed per account).
 */
export async function approveAgent(params: {
  walletClient: WalletClient;
  agentAddress: string;
  agentName?: string;
}) {
  return signUserAction(
    params.walletClient,
    { agentAddress: params.agentAddress, agentName: params.agentName ?? "" },
    "approveAgent",
    {
      "HyperliquidTransaction:ApproveAgent": [
        { name: "hyperliquidChain", type: "string" },
        { name: "agentAddress", type: "address" },
        { name: "agentName", type: "string" },
        { name: "nonce", type: "uint64" },
      ],
    }
  );
}

/**
 * Withdraw USDC from the perp account to an Arbitrum address.
 * Master-signed (agents cannot withdraw). HL charges a $1 fee; funds arrive
 * on Arbitrum in a few minutes. `time` doubles as the request nonce.
 */
export async function withdraw(params: {
  walletClient: WalletClient;
  amount: string;
  destination: string;
}) {
  const time = Date.now();
  const destination = params.destination.toLowerCase();
  const action = {
    type: "withdraw3",
    signatureChainId: "0xa4b1",
    hyperliquidChain: "Mainnet",
    amount: params.amount,
    time,
    destination,
  };
  const sig = await params.walletClient.signTypedData({
    domain: {
      name: "HyperliquidSignTransaction",
      version: "1",
      chainId: 42161,
      verifyingContract: ZERO_ADDRESS,
    },
    types: {
      "HyperliquidTransaction:Withdraw": [
        { name: "hyperliquidChain", type: "string" },
        { name: "destination", type: "string" },
        { name: "amount", type: "string" },
        { name: "time", type: "uint64" },
      ],
    },
    primaryType: "HyperliquidTransaction:Withdraw",
    message: { hyperliquidChain: "Mainnet", destination, amount: params.amount, time },
  });
  return postExchange({ action, nonce: time, signature: splitSig(sig) });
}

/** Move USDC between spot and perp accounts. */
export async function usdClassTransfer(params: {
  walletClient: WalletClient;
  amount: string;
  toPerp: boolean;
}) {
  return signUserAction(
    params.walletClient,
    { amount: params.amount, toPerp: params.toPerp },
    "usdClassTransfer",
    {
      "HyperliquidTransaction:UsdClassTransfer": [
        { name: "hyperliquidChain", type: "string" },
        { name: "amount", type: "string" },
        { name: "toPerp", type: "bool" },
        { name: "nonce", type: "uint64" },
      ],
    }
  );
}
