"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAllMids,
  getMetaAndAssetCtxs,
  getPerpDexs,
  type AssetCtx,
} from "@/lib/hl";

export interface Market {
  /** Display ticker, e.g. "BTC", "TSLA" */
  name: string;
  /** Coin string used in every API call: "BTC" (main) or "xyz:TSLA" (HIP-3) */
  coin: string;
  /** "" for the main perp DEX, otherwise the HIP-3 dex name */
  dex: string;
  /** Numeric asset id used when placing orders */
  index: number;
  szDecimals: number;
  maxLeverage: number;
  markPx: number;
  prevDayPx: number;
  changePct: number;
  volume24h: number;
  openInterest: number;
  funding: number;
  /** True when the asset supports isolated margin only (no cross). */
  onlyIsolated: boolean;
}

function toMarket(
  asset: {
    name: string;
    szDecimals: number;
    maxLeverage: number;
    onlyIsolated?: boolean;
  },
  ctx: AssetCtx | undefined,
  dex: string,
  index: number
): Market {
  const markPx = parseFloat(ctx?.markPx ?? "0");
  const prevDayPx = parseFloat(ctx?.prevDayPx ?? "0");
  const changePct =
    prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;
  const cleanName =
    dex && asset.name.startsWith(`${dex}:`)
      ? asset.name.slice(dex.length + 1)
      : asset.name;
  return {
    name: cleanName,
    coin: dex ? `${dex}:${cleanName}` : cleanName,
    dex,
    index,
    szDecimals: asset.szDecimals,
    maxLeverage: asset.maxLeverage,
    markPx,
    prevDayPx,
    changePct,
    volume24h: parseFloat(ctx?.dayNtlVlm ?? "0"),
    openInterest: parseFloat(ctx?.openInterest ?? "0") * markPx,
    funding: parseFloat(ctx?.funding ?? "0"),
    onlyIsolated: asset.onlyIsolated ?? false,
  };
}

/** All perp markets across the main DEX and every HIP-3 DEX. */
export function useMarkets() {
  const marketsQuery = useQuery({
    queryKey: ["markets"],
    queryFn: async (): Promise<Market[]> => {
      let dexList: (unknown | null)[] = [];
      try {
        dexList = await getPerpDexs();
      } catch {
        // main DEX only if perpDexs is unavailable
      }

      // index 0 is the main DEX (null); 1+ are HIP-3 DEXes
      const hip3 = (dexList || [])
        .map((d, i) => ({ d: d as { name?: string } | null, i }))
        .filter(({ d }) => d && d.name);

      const [mainRes, ...hip3Res] = await Promise.all([
        getMetaAndAssetCtxs(),
        ...hip3.map(({ d }) => getMetaAndAssetCtxs(d!.name).catch(() => null)),
      ]);

      const out: Market[] = [];

      const [mainMeta, mainCtxs] = mainRes;
      mainMeta.universe.forEach((asset, idx) =>
        out.push(toMarket(asset, mainCtxs[idx], "", idx))
      );

      // HIP-3 asset id = 100000 + perpDexIndex * 10000 + indexInDex,
      // where perpDexIndex is the position in the full perpDexs list.
      hip3.forEach(({ d, i: perpDexIndex }, k) => {
        const res = hip3Res[k];
        if (!res) return;
        const [meta, ctxs] = res;
        meta.universe?.forEach((asset, idx) =>
          out.push(
            toMarket(asset, ctxs[idx], d!.name!, 100000 + perpDexIndex * 10000 + idx)
          )
        );
      });

      return out;
    },
    refetchInterval: 30_000,
    staleTime: 0,
  });

  // Live mid prices refresh far faster than the heavier meta payload.
  const midsQuery = useQuery({
    queryKey: ["mids"],
    queryFn: getAllMids,
    refetchInterval: 2_000,
    staleTime: 0,
  });

  const mids = midsQuery.data;
  // Merge live mids into the market list, but PRESERVE each market's object
  // identity when its price is unchanged. React Query's structural sharing
  // keeps `mids`/`data` references stable across polls, so this memo only
  // recomputes when something actually changed — and unchanged rows keep the
  // same reference, letting memoized row components skip re-rendering.
  const markets = useMemo(() => {
    const base = marketsQuery.data ?? [];
    if (!mids) return base;
    return base.map((m) => {
      const live = mids[m.coin];
      if (!live) return m;
      const markPx = parseFloat(live);
      if (!markPx || markPx === m.markPx) return m;
      const changePct =
        m.prevDayPx > 0
          ? ((markPx - m.prevDayPx) / m.prevDayPx) * 100
          : m.changePct;
      return { ...m, markPx, changePct };
    });
  }, [marketsQuery.data, mids]);

  return {
    markets,
    isLoading: marketsQuery.isLoading,
    isError: marketsQuery.isError,
    updatedAt: midsQuery.dataUpdatedAt,
  };
}
