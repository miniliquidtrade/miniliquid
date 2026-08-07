"use client";

import { memo, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Market } from "@/hooks/useMarkets";
import { useWallet } from "@/hooks/useWallet";
import { useAgent } from "@/hooks/useAgent";
import { useAccount } from "@/hooks/useAccount";
import { useToast } from "@/hooks/useToast";
import dynamic from "next/dynamic";
import { marketOrder } from "@/lib/hlExchange";
import { optimisticPositions } from "@/lib/optimisticPositions";
import {
  fmtPrice,
  fmtCompact,
  estLiqPrice,
  fundingInfo,
  errMsg,
  cn,
} from "@/lib/format";

// Only the selected row shows a chart — load it on demand.
const AssetChart = dynamic(
  () => import("@/components/AssetChart").then((m) => m.AssetChart),
  { ssr: false }
);

function abbrev(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `${n}`;
}

type Dir = "long" | "short";

export const TradeLine = memo(function TradeLine({
  market,
  selected,
  index = 0,
  onPlaced,
}: {
  market: Market;
  selected: boolean;
  index?: number;
  onPlaced?: () => void;
}) {
  const { connect, wallets } = useWallet();
  const { l1Signer, runL1 } = useAgent();
  const { available } = useAccount();
  const { notify } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<Dir | null>(null);

  const maxLev = Math.max(1, market.maxLeverage);
  const [lev, setLev] = useState(() => Math.min(5, maxLev));
  useEffect(() => {
    setLev((l) => Math.min(Math.max(1, l), maxLev));
  }, [maxLev]);

  // Margin mode. Cross by default; assets flagged onlyIsolated can't use it,
  // so those are pinned to isolated and the toggle is replaced by a label.
  const [isCross, setIsCross] = useState(true);
  useEffect(() => {
    if (market.onlyIsolated) setIsCross(false);
  }, [market.onlyIsolated]);
  const cross = isCross && !market.onlyIsolated;

  // `amount` is the money the user commits (margin). Position size scales it
  // up by leverage: exposure = margin × leverage.
  const usd = parseFloat(amount) || 0;
  const exposure = usd * lev;
  // Free collateral they can deploy (shared with the header + Withdraw); leave
  // a small buffer so fees/slippage don't tip the order past their margin.
  const maxSpend = Math.floor(available * 0.98 * 100) / 100;
  const prime = market.dex === "" || market.dex === "xyz";
  const longLiq = estLiqPrice(market.markPx, lev, maxLev, true);
  const shortLiq = estLiqPrice(market.markPx, lev, maxLev, false);
  const fund = fundingInfo(market.funding);
  // Common leverage snaps, capped to this market's max (Max added separately).
  const levPresets = [2, 5, 10, 25].filter((v) => v < maxLev);

  const place = async (dir: Dir) => {
    if (usd <= 0) {
      notify("err", "Enter an amount first");
      return;
    }
    if (market.markPx <= 0) return;
    if (!l1Signer) {
      connect(wallets[0]?.rdns ?? "injected");
      return;
    }
    setBusy(dir);
    try {
      await runL1(
        (signer) =>
          marketOrder({
            walletClient: signer,
            asset: market.index,
            isBuy: dir === "long",
            size: exposure / market.markPx,
            price: market.markPx,
            szDecimals: market.szDecimals,
            leverage: Math.min(lev, maxLev),
            isCross: cross,
          }),
        () =>
          notify(
            "ok",
            "Re-approving 1-click (one signature) and placing your order…"
          )
      );
      const side = dir === "long" ? "Longed" : "Shorted";
      notify(
        "ok",
        `${side} $${abbrev(usd)} at ${lev}× (~$${abbrev(exposure)} of ${market.name}). Position shown below.`
      );
      // Show the position immediately; real data reconciles it moments later.
      const capped = Math.min(lev, maxLev);
      optimisticPositions.addOpen({
        coin: market.coin,
        szi: String((dir === "long" ? 1 : -1) * (exposure / market.markPx)),
        entryPx: String(market.markPx),
        positionValue: String(exposure),
        unrealizedPnl: "0",
        returnOnEquity: "0",
        liquidationPx: String(
          estLiqPrice(market.markPx, capped, maxLev, dir === "long")
        ),
        leverage: { type: cross ? "cross" : "isolated", value: capped },
        marginUsed: String(usd),
      });
      setAmount("");
      // HL can take a beat to reflect the fill — refetch a few times so the
      // new position reliably appears without waiting for the next poll.
      const refresh = () => {
        qc.invalidateQueries({ queryKey: ["clearinghouse"] });
        qc.invalidateQueries({ queryKey: ["openOrders"] });
        qc.invalidateQueries({ queryKey: ["extraPositions"] });
      };
      refresh();
      setTimeout(refresh, 1200);
      setTimeout(refresh, 3000);
      // Clear the search so the results list collapses back to a clean screen.
      onPlaced?.();
    } catch (e) {
      notify("err", `Order failed: ${errMsg(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-3 text-[12px] transition",
        selected ? "bg-black/[0.04]" : "hover:bg-black/[0.025]",
        prime ? "row-in" : "opacity-40 hover:opacity-100"
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
    >
      {/* Symbol */}
      <div className="flex w-24 shrink-0 items-center gap-1.5 sm:w-28">
        <span className="truncate text-[14px] font-semibold text-term-hi sm:text-[15px]">
          {market.name}
        </span>
        {market.dex && (
          <span className="shrink-0 border border-term-line px-1 text-[8px] uppercase text-term-dim">
            {market.dex}
          </span>
        )}
      </div>

      {/* Price — the key figure; give it weight. Fills the row on mobile. */}
      <div className="flex-1 text-right text-[15px] font-medium tabular-nums text-term-hi sm:w-28 sm:flex-none sm:text-base">
        {fmtPrice(market.markPx)}
      </div>

      {/* 24h volume / OI — desktop only. Kept quiet, but dark enough to read
          against the highlighted background when a market card opens. */}
      <div className="hidden w-24 shrink-0 text-right text-[11px] tabular-nums text-term-mid md:block">
        <span className="mr-1 text-[8px] uppercase tracking-wider text-term-dim">
          vol
        </span>
        ${fmtCompact(market.volume24h)}
      </div>
      <div className="hidden w-24 shrink-0 text-right text-[11px] tabular-nums text-term-mid lg:block">
        <span className="mr-1 text-[8px] uppercase tracking-wider text-term-dim">
          oi
        </span>
        ${fmtCompact(market.openInterest)}
      </div>

      {/* Controls — Margin · Leverage · You pay · Long/Short, aligned as
          columns with each preset row stacked directly beneath its own control.
          Full-width stacked on mobile; a row from sm up. gap-4 (not ml-auto's
          old gap-5) pulls the controls a touch left for more even margins. */}
      <div className="flex w-full flex-col gap-3 sm:ml-auto sm:w-auto sm:flex-row sm:items-start sm:gap-4">
        {/* Margin mode — Cross / Isolated. Assets that only allow isolated
            show a static label instead of a toggle (there's no choice). */}
        <div className="flex flex-col gap-1.5">
          {selected && (
            <span className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-term-dim">
              Margin
              {/* Minimal explainer — a single ? that reveals a plain-language
                  note on hover. Same tooltip pattern as 1-click in the header,
                  so it reads as native and adds no clutter until wanted. */}
              <span className="group relative inline-flex">
                <button
                  type="button"
                  aria-label="What is cross vs isolated margin?"
                  className="flex h-3 w-3 items-center justify-center rounded-full border border-term-line text-[7px] leading-none text-term-dim hover:text-term-fg"
                >
                  ?
                </button>
                <span className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-56 border border-term-line bg-term-panel p-2.5 text-left text-[10px] normal-case leading-relaxed tracking-normal text-term-mid group-hover:block group-focus-within:block">
                  <span className="mb-1 block font-medium uppercase tracking-wider text-term-fg">
                    Cross vs isolated
                  </span>
                  <span className="block">
                    <span className="text-term-fg">Cross</span> backs the trade
                    with your whole balance — more staying power, but a bad trade
                    can draw down everything.
                  </span>
                  <span className="mt-1 block">
                    <span className="text-term-fg">Isolated</span> risks only the
                    margin you put in — your max loss is that amount, nothing more.
                  </span>
                </span>
              </span>
            </span>
          )}
          <div className="flex h-9 items-stretch">
            {market.onlyIsolated ? (
              <span
                className="flex items-center border border-term-line px-2.5 text-[10px] uppercase tracking-wider text-term-dim"
                title="This market supports isolated margin only"
              >
                Isolated
              </span>
            ) : (
              <div className="flex text-[10px] uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setIsCross(true)}
                  className={cn(
                    "border px-2.5 transition-colors",
                    cross
                      ? "border-term-fg bg-term-fg text-term-bg"
                      : "border-term-line text-term-mid hover:text-term-fg"
                  )}
                  title="Cross margin — shares collateral across all positions"
                >
                  Cross
                </button>
                <button
                  type="button"
                  onClick={() => setIsCross(false)}
                  className={cn(
                    "border border-l-0 px-2.5 transition-colors",
                    !cross
                      ? "border-term-fg bg-term-fg text-term-bg"
                      : "border-term-line text-term-mid hover:text-term-fg"
                  )}
                  title="Isolated margin — only this position's margin is at risk"
                >
                  Iso
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Leverage */}
        <div className="flex flex-col gap-1.5">
          {selected && (
            <span className="text-[8px] uppercase tracking-wider text-term-dim">
              Leverage
            </span>
          )}
          <div className="flex h-9 items-center gap-2">
            <input
              type="range"
              min={1}
              max={maxLev}
              value={lev}
              onChange={(e) => setLev(parseInt(e.target.value))}
              className="w-full accent-black sm:w-24"
              aria-label="Leverage"
              title={`Leverage — max ${maxLev}× for ${market.name}`}
            />
            <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-term-fg">
              {lev}×
            </span>
          </div>
          {selected && (
            <div className="flex flex-wrap gap-1 text-[10px]">
              {levPresets.map((v) => (
                <button
                  key={v}
                  onClick={() => setLev(v)}
                  className={cn(
                    "border px-1.5 py-0.5 tabular-nums",
                    lev === v
                      ? "border-term-fg text-term-fg"
                      : "border-term-line text-term-mid hover:text-term-fg"
                  )}
                >
                  {v}×
                </button>
              ))}
              <button
                onClick={() => setLev(maxLev)}
                className={cn(
                  "border px-1.5 py-0.5 tabular-nums",
                  lev === maxLev
                    ? "border-term-fg text-term-fg"
                    : "border-term-line text-term-mid hover:text-term-fg"
                )}
              >
                Max {maxLev}×
              </button>
            </div>
          )}
        </div>

        {/* You pay (margin) */}
        <div className="flex flex-col gap-1.5">
          {selected && (
            <span className="text-[8px] uppercase tracking-wider text-term-dim">
              You pay ($)
            </span>
          )}
          {/* Wider so the full preset row (10 · 25 · 50 · Max) sits on one
              line beneath it — the old in-field Max button is gone, since Max
              now lives in that row. */}
          <div className="relative h-9 w-full sm:w-40">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-term-dim">
              $
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") place("long");
              }}
              inputMode="decimal"
              placeholder="you pay"
              className="h-9 w-full border border-term-line bg-transparent pl-6 pr-3 text-[14px] tabular-nums text-term-fg outline-none focus:border-term-mid"
            />
          </div>
          {selected && maxSpend > 0 && (
            <div className="flex flex-nowrap justify-between gap-1 text-[10px] sm:w-40">
              {[0.1, 0.25, 0.5].map((f) => (
                <button
                  key={f}
                  onClick={() => setAmount((maxSpend * f).toFixed(2))}
                  className="border border-term-line px-2 py-0.5 tabular-nums text-term-mid hover:text-term-fg"
                  title={`${Math.round(f * 100)}% of your available balance`}
                >
                  {Math.round(f * 100)}%
                </button>
              ))}
              <button
                onClick={() => setAmount(maxSpend.toString())}
                className="border border-term-line px-2 py-0.5 uppercase tabular-nums text-term-mid hover:text-term-fg"
                title={`Your full available balance ($${maxSpend.toFixed(2)})`}
              >
                Max
              </button>
            </div>
          )}
        </div>

        {/* Long / Short — spacer label keeps the buttons aligned with the
            inputs when the column headers show on the selected row. */}
        <div className="flex flex-col gap-1.5">
          {selected && (
            <span aria-hidden className="hidden text-[8px] uppercase tracking-wider text-term-dim sm:block">
              &nbsp;
            </span>
          )}
          <div className="flex h-9 gap-2">
            <button
              onClick={() => place("long")}
              disabled={busy !== null || usd <= 0}
              className="h-9 flex-1 bg-term-hi text-[12px] font-medium uppercase tracking-wider text-term-bg hover:bg-term-fg disabled:opacity-30 sm:w-20 sm:flex-none"
            >
              {busy === "long" ? "…" : "Long"}
            </button>
            <button
              onClick={() => place("short")}
              disabled={busy !== null || usd <= 0}
              className="h-9 flex-1 border border-term-fg text-[12px] font-medium uppercase tracking-wider text-term-fg hover:bg-black/5 disabled:opacity-30 sm:w-20 sm:flex-none"
            >
              {busy === "short" ? "…" : "Short"}
            </button>
          </div>
        </div>
      </div>

      {/* Chart on the left, trade summary on the right (under the controls);
          stacked on mobile. */}
      {(selected || (usd > 0 && market.markPx > 0)) && (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          {selected && (
            <div className="min-w-0 w-full sm:max-w-lg sm:flex-1">
              <AssetChart coin={market.coin} />
            </div>
          )}
          {(selected || (usd > 0 && market.markPx > 0)) && (
            <div className="shrink-0 space-y-0.5 pl-1 text-[10px] leading-relaxed tabular-nums text-term-dim sm:ml-auto sm:pl-0 sm:text-right">
              {usd > 0 && market.markPx > 0 && (
                <>
                  <div>
                    ${fmtCompact(usd)} in → ~${fmtCompact(exposure)} position at{" "}
                    {lev}× · {cross ? "cross" : "isolated"}
                  </div>
                  <div>
                    liq long{" "}
                    <span className="text-term-fg">${fmtPrice(longLiq)}</span> ·
                    short{" "}
                    <span className="text-term-fg">${fmtPrice(shortLiq)}</span>
                  </div>
                </>
              )}
              {/* Funding, in plain language: who pays whom, the hourly rate,
                  and roughly what that annualizes to. Charged every hour. */}
              <div title="Funding is exchanged every hour between longs and shorts. Positive means longs pay shorts.">
                Funding ·{" "}
                {fund.payer ? (
                  <>
                    <span className="text-term-fg">{fund.label}</span>{" "}
                    <span className="text-term-fg">
                      {Math.abs(fund.hourlyPct).toFixed(4)}%/hr
                    </span>{" "}
                    <span className="text-term-mid">
                      (~{Math.abs(fund.annualPct).toFixed(0)}%/yr)
                    </span>
                  </>
                ) : (
                  <span className="text-term-mid">flat right now</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
