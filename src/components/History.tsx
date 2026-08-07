"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { getUserFills } from "@/lib/hl";
import { useWallet } from "@/hooks/useWallet";
import type { PnlCardData } from "@/components/PnlCard";
import { decodeLeverageCloid } from "@/lib/hlExchange";
import { fmtPrice, cn } from "@/lib/format";

const PnlCard = dynamic(
  () => import("@/components/PnlCard").then((m) => m.PnlCard),
  { ssr: false }
);

const ticker = (coin: string) =>
  coin.includes(":") ? coin.slice(coin.indexOf(":") + 1) : coin;

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function fmtWhen(t: number): string {
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function History() {
  const { address } = useWallet();
  const [share, setShare] = useState<PnlCardData | null>(null);

  const { data } = useQuery({
    queryKey: ["fills", address],
    queryFn: () => getUserFills(address!),
    enabled: !!address,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const fills = useMemo(
    () => (data ?? []).slice().sort((a, b) => b.time - a.time).slice(0, 100),
    [data]
  );

  const totals = useMemo(() => {
    // miniliquid charges no fee; `fee` is Hyperliquid's protocol fee in full.
    let pnl = 0;
    let feeTotal = 0;
    for (const f of fills) {
      pnl += parseFloat(f.closedPnl) || 0;
      feeTotal += parseFloat(f.fee) || 0;
    }
    return { pnl, fees: feeTotal };
  }, [fills]);

  if (!address) return null;

  if (fills.length === 0) {
    return (
      <p className="px-1 py-3 text-[11px] text-term-dim">No trade history yet.</p>
    );
  }

  return (
    <div>
      {/* Totals over the shown fills — with a fee breakdown */}
      <div className="space-y-0.5 px-1 pb-2 text-[10px] text-term-dim">
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          <span>
            Realized P&amp;L{" "}
            <span
              className={cn(
                "tabular-nums",
                totals.pnl >= 0 ? "text-term-up" : "text-term-down"
              )}
            >
              {totals.pnl >= 0 ? "+" : "-"}${Math.abs(totals.pnl).toFixed(2)}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          <span title={`Exact: ${totals.fees}`}>
            Hyperliquid fees{" "}
            <span className="tabular-nums text-term-fg">
              ${totals.fees.toFixed(2)}
            </span>
          </span>
          <span className="tabular-nums">· last {fills.length}</span>
        </div>
      </div>

      <div className="max-h-96 space-y-2.5 overflow-y-auto pt-1">
        {fills.map((f) => {
          const px = parseFloat(f.px) || 0;
          const sz = parseFloat(f.sz) || 0;
          const pnl = parseFloat(f.closedPnl) || 0;
          const hlFee = parseFloat(f.fee) || 0;
          const isClose = /close/i.test(f.dir);
          const isLong = /long/i.test(f.dir);
          // Leverage rides with the trade in the cloid (works cross-device).
          // Shown as a badge only — history shows realized $, no % (as on
          // Hyperliquid; ROE % is reserved for live positions).
          const lev = decodeLeverageCloid(f.cloid);
          // Exact entry price derived from realized P&L, for the card's
          // entry → exit line.
          //   long  closedPnl = (exit - entry)·sz  → entryNotional = exit·sz - pnl
          //   short closedPnl = (entry - exit)·sz  → entryNotional = exit·sz + pnl
          const entryNotional = px * sz + (isLong ? -pnl : pnl);
          const entryPx =
            sz > 0 && entryNotional > 0 ? entryNotional / sz : undefined;
          return (
            <div
              key={`${f.hash}-${f.oid}-${f.time}-${f.tid ?? ""}`}
              className="rounded-xl border border-term-line p-3 transition-colors hover:border-term-mid sm:p-4"
            >
              {/* Header — ticker · action/leverage · realized P&L */}
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-term-hi">
                  {ticker(f.coin)}
                </span>
                <span className="rounded-full border border-term-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-term-mid">
                  {f.dir}
                  {lev ? ` ${Math.round(lev)}×` : ""}
                </span>
                <span
                  title={isClose ? `Exact P&L: ${f.closedPnl}` : undefined}
                  className={cn(
                    "ml-auto text-right text-[15px] font-semibold tabular-nums",
                    isClose
                      ? pnl >= 0
                        ? "text-term-up"
                        : "text-term-down"
                      : "text-term-dim"
                  )}
                >
                  {isClose
                    ? `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`
                    : "—"}
                </span>
              </div>

              {/* Detail — entry → exit (closes) / price · size · fees · time */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tabular-nums text-term-dim">
                {isClose && entryPx ? (
                  <>
                    <span>
                      entry{" "}
                      <span className="text-term-mid">{fmtPrice(entryPx)}</span>
                    </span>
                    <span aria-hidden className="text-term-line">
                      →
                    </span>
                    <span>
                      exit <span className="text-term-fg">{fmtPrice(px)}</span>
                    </span>
                  </>
                ) : (
                  <span>
                    price <span className="text-term-fg">{fmtPrice(px)}</span>
                  </span>
                )}
                <span>
                  size{" "}
                  <span className="text-term-mid">{usd(Math.abs(sz * px))}</span>
                </span>
                <span title={`Exact: ${f.fee}`}>
                  fee <span className="text-term-mid">${hlFee.toFixed(2)}</span>
                </span>
                <span className="ml-auto">{fmtWhen(f.time)}</span>
              </div>

              {/* Action — share a P&L card (realized closes only) */}
              {isClose && pnl !== 0 && (
                <div className="mt-3">
                  <button
                    onClick={() =>
                      setShare({
                        coin: ticker(f.coin),
                        isLong,
                        leverage: lev,
                        entryPx,
                        markPx: px,
                        pnlUsd: pnl,
                        realized: true,
                      })
                    }
                    className="border border-term-line px-2.5 py-1 text-[10px] uppercase tracking-wider text-term-fg hover:bg-black/5"
                    title="Share a P&L card"
                  >
                    Share
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {share && <PnlCard data={share} onClose={() => setShare(null)} />}
    </div>
  );
}
