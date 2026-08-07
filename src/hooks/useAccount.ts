"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getClearinghouseState,
  getSpotState,
  getOpenOrders,
  getWebData2,
  getPerpDexs,
  type Position,
  type ClearinghouseState,
} from "@/lib/hl";
import { optimisticPositions } from "@/lib/optimisticPositions";
import { useWallet } from "@/hooks/useWallet";

/**
 * Collect open perp positions wherever HL puts them.
 *
 * Standard (separate) accounts expose a top-level `assetPositions` array.
 * Unified / portfolio-margin accounts nest per-DEX states (e.g. under a
 * "native" key and HIP-3 dex names), each with their own `assetPositions`, and
 * the old flat array can come back empty. We walk the response and gather every
 * `assetPositions` array so positions show in either mode.
 */
function isPosition(o: unknown): o is Position {
  return (
    !!o &&
    typeof o === "object" &&
    "coin" in o &&
    "szi" in o &&
    ("entryPx" in o || "positionValue" in o)
  );
}

function collectPositions(data: unknown): Position[] {
  const out: Position[] = [];
  const seen = new Set<string>();
  const add = (p: Position) => {
    if (p.coin && !seen.has(p.coin)) {
      seen.add(p.coin);
      out.push(p);
    }
  };
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object" || depth > 6) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        // Items are usually { type, position: {...} }, sometimes bare positions.
        const pos = (item as { position?: unknown })?.position;
        if (isPosition(pos)) add(pos);
        else if (isPosition(item)) add(item);
        else walk(item, depth + 1);
      }
      return;
    }
    if (isPosition(node)) {
      add(node);
      return;
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (value && typeof value === "object") walk(value, depth + 1);
    }
  };
  walk(data, 0);
  return out.filter((p) => parseFloat(p.szi) !== 0);
}

/** Perp clearinghouse state + spot USDC for the connected wallet. */
export function useAccount() {
  const { address } = useWallet();

  const perp = useQuery({
    queryKey: ["clearinghouse", address],
    queryFn: () => getClearinghouseState(address!),
    enabled: !!address,
    refetchInterval: 4_000,
    staleTime: 0,
  });

  const spot = useQuery({
    queryKey: ["spot", address],
    queryFn: () => getSpotState(address!),
    enabled: !!address,
    refetchInterval: 10_000,
    staleTime: 0,
  });

  const orders = useQuery({
    queryKey: ["openOrders", address],
    queryFn: () => getOpenOrders(address!),
    enabled: !!address,
    refetchInterval: 4_000,
    staleTime: 0,
  });

  // Positions can live outside the plain (native) clearinghouseState: on HIP-3
  // perp DEXes (e.g. Trade.xyz stocks) they need a per-DEX query, and on
  // unified accounts they surface via webData2. Pull them all together.
  const extra = useQuery({
    queryKey: ["extraPositions", address],
    enabled: !!address,
    refetchInterval: 5_000,
    staleTime: 0,
    queryFn: async () => {
      let hip3: string[] = [];
      try {
        const dexes = await getPerpDexs();
        hip3 = (dexes ?? [])
          .filter(
            (d): d is { name: string } =>
              !!d && typeof (d as { name?: string }).name === "string"
          )
          .map((d) => d.name);
      } catch {
        /* native only */
      }
      return Promise.all([
        getWebData2(address!).catch(() => null),
        ...hip3.map((name) =>
          getClearinghouseState(address!, name).catch(() => null)
        ),
      ]);
    },
  });

  // Derive everything ONCE per data change. collectPositions deep-walks a
  // large webData2 payload, so running it (and rebuilding the positions array)
  // on every render — across all four useAccount consumers — was the main
  // source of jank during the open/close refetch burst. Memoizing keeps the
  // walk off the render path and gives positions a stable identity so
  // downstream rows don't re-render needlessly.
  const derived = useMemo(() => {
    // Perp account summary. Prefer webData2's clearinghouseState (correct for
    // unified accounts, where the plain perp query can read 0), else the native
    // clearinghouseState. This is the PERPS balance only — spot is excluded.
    const webChs = (
      extra.data?.[0] as { clearinghouseState?: ClearinghouseState } | null
    )?.clearinghouseState;
    const summary = webChs?.marginSummary ? webChs : perp.data;
    const num = (s?: string) => (s ? parseFloat(s) : 0) || 0;
    const accountValue = num(summary?.marginSummary?.accountValue);
    const marginUsed = num(summary?.marginSummary?.totalMarginUsed);
    // Free collateral. HL's `withdrawable` is the canonical figure, but some
    // account shapes (unified / webData2) report it as 0 even with real
    // balance, so fall back to accountValue − margin (cross-margin free).
    const withdrawable = Math.max(
      num(summary?.withdrawable),
      accountValue - marginUsed
    );
    // Gather positions from every source; the combined walk dedups by coin.
    const positions = collectPositions({ native: perp.data, extra: extra.data });

    const usdcBal = spot.data?.balances?.find((b) => b.coin === "USDC");
    const spotUsdc = usdcBal ? parseFloat(usdcBal.total) : 0;

    // Free collateral available to open trades or withdraw. Works whether the
    // balance reports under the perp summary or the spot/unified balance — the
    // single figure the header, trade sizing, and Withdraw all share.
    const available = Math.max(0, withdrawable, spotUsdc - marginUsed);

    return { accountValue, withdrawable, available, marginUsed, positions, spotUsdc };
  }, [perp.data, extra.data, spot.data]);

  const openOrders = useMemo(() => orders.data ?? [], [orders.data]);

  // Optimistic overlay: reflect the user's own open/close instantly, then
  // reconcile once the real clearinghouse data catches up.
  const overlay = useSyncExternalStore(
    optimisticPositions.subscribe,
    optimisticPositions.getSnapshot,
    optimisticPositions.getSnapshot
  );

  const realPositions = derived.positions;
  useEffect(() => {
    optimisticPositions.reconcile(new Set(realPositions.map((p) => p.coin)));
  }, [realPositions]);

  const positions = useMemo(() => {
    const realCoins = new Set(realPositions.map((p) => p.coin));
    // Hide positions the user just fully closed; append ones they just opened
    // that the server hasn't reported yet.
    const merged = realPositions.filter((p) => !overlay.closes[p.coin]);
    for (const coin of Object.keys(overlay.opens)) {
      if (!realCoins.has(coin)) merged.push(overlay.opens[coin]);
    }
    return merged;
  }, [realPositions, overlay]);

  // Coins still awaiting server confirmation of an open — the row is shown but
  // its actions stay disabled until it's real.
  const pendingCoins = useMemo(
    () => new Set(Object.keys(overlay.opens)),
    [overlay]
  );

  const refetch = useCallback(() => {
    perp.refetch();
    spot.refetch();
    orders.refetch();
    extra.refetch();
  }, [perp, spot, orders, extra]);

  return {
    ...derived,
    positions,
    pendingCoins,
    openOrders,
    isLoading: perp.isLoading,
    refetch,
  };
}
