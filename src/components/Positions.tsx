"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Market } from "@/hooks/useMarkets";
import { useWallet } from "@/hooks/useWallet";
import { useAgent } from "@/hooks/useAgent";
import { useAccount } from "@/hooks/useAccount";
import { useToast } from "@/hooks/useToast";
import dynamic from "next/dynamic";
import { closePosition, placeTpSlOrders } from "@/lib/hlExchange";
import { optimisticPositions } from "@/lib/optimisticPositions";
import { History } from "@/components/History";
import type { PnlCardData } from "@/components/PnlCard";
import { AnimatedNumber } from "@/lib/useAnimatedNumber";
import { fmtPrice, errMsg, cn } from "@/lib/format";

const PnlCard = dynamic(
  () => import("@/components/PnlCard").then((m) => m.PnlCard),
  { ssr: false }
);

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// Show just the ticker — drop the "dex:" prefix (e.g. "xyz:GOLD" → "GOLD").
const ticker = (coin: string) =>
  coin.includes(":") ? coin.slice(coin.indexOf(":") + 1) : coin;

export function Positions({ markets }: { markets: Market[] }) {
  const { address } = useWallet();
  const { runL1 } = useAgent();
  const { positions, pendingCoins } = useAccount();
  const { notify } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "history">("open");
  const [share, setShare] = useState<PnlCardData | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["clearinghouse"] });
    qc.invalidateQueries({ queryKey: ["openOrders"] });
    qc.invalidateQueries({ queryKey: ["extraPositions"] });
  };
  const mk = (coin: string) => markets.find((m) => m.coin === coin);

  const doClose = async (coin: string, frac: number) => {
    const m = mk(coin);
    const p = positions.find((x) => x.coin === coin);
    if (!m || !p) return;
    setBusy(`${coin}:${frac}`);
    try {
      const szi = parseFloat(p.szi);
      await runL1(
        (signer) =>
          closePosition({
            walletClient: signer,
            asset: m.index,
            isLong: szi > 0,
            size: Math.abs(szi) * frac,
            price: m.markPx,
            szDecimals: m.szDecimals,
            leverage: p.leverage?.value,
          }),
        () =>
          notify("ok", "Re-approving 1-click (one signature) and closing…")
      );
      notify(
        "ok",
        frac >= 1
          ? `Closed ${p.coin} position.`
          : `Closed ${Math.round(frac * 100)}% of ${p.coin}.`
      );
      // A full close hides the row immediately; real data confirms it's gone.
      if (frac >= 1) optimisticPositions.addClose(coin);
      setTimeout(refresh, 700);
    } catch (e) {
      notify("err", `Close failed: ${errMsg(e)}`);
    } finally {
      setBusy(null);
    }
  };

  if (!address) return null;

  const tabs = (
    <div className="flex items-center gap-3 px-1 pb-1">
      {(["open", "history"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={cn(
            "text-[9px] uppercase tracking-wider transition-colors",
            tab === t ? "text-term-fg" : "text-term-dim hover:text-term-mid"
          )}
        >
          {t === "open" ? "Positions" : "History"}
        </button>
      ))}
    </div>
  );

  if (tab === "history") {
    return (
      <div>
        {tabs}
        <History />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div>
        {tabs}
        <p className="px-1 py-3 text-[11px] text-term-dim">
          No open positions yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      {tabs}

      <div className="space-y-2.5 pt-1">
        {positions.map((p) => {
          const m = mk(p.coin);
          const szi = parseFloat(p.szi);
          const isLong = szi > 0;
          const entry = p.entryPx ? parseFloat(p.entryPx) : 0;
          // Live mark from the fast mids poll — the same figure shown in the
          // Mark column.
          const live = m && m.markPx > 0 ? m.markPx : 0;
          // Derive P&L and notional from that SAME live mark so they move in
          // lockstep with the displayed price. HL's clearinghouse figures poll
          // on a slower clock and against its own mark, which made P&L appear
          // to update faster than (and out of sync with) the price. Fall back
          // to HL's reported values when we don't have a live mark yet.
          const value = live > 0 ? Math.abs(szi) * live : parseFloat(p.positionValue);
          const pnl =
            live > 0 && entry > 0
              ? szi * (live - entry)
              : parseFloat(p.unrealizedPnl);
          const lev = p.leverage?.value ?? 1;
          // Return on the margin actually invested (not on notional): P&L ÷
          // margin. Fall back to notional ÷ leverage if marginUsed is absent.
          const margin =
            parseFloat(p.marginUsed) || (value > 0 && lev ? value / lev : 0);
          const roe = margin > 0 ? (pnl / margin) * 100 : 0;
          const open = expanded === p.coin;
          // Optimistically-shown position, not yet confirmed by the server.
          const pending = pendingCoins.has(p.coin);
          return (
            <div
              key={p.coin}
              className="rounded-xl border border-term-line p-3 transition-colors hover:border-term-mid sm:p-4"
            >
              {/* Header — ticker · side/lev · P&L */}
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-term-hi">
                  {ticker(p.coin)}
                </span>
                <span className="rounded-full border border-term-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-term-mid">
                  {isLong ? "Long" : "Short"} {Math.round(lev)}×
                </span>
                {pending ? (
                  <span className="ml-auto text-[13px] text-term-dim">
                    opening…
                  </span>
                ) : (
                  <span
                    className={cn(
                      "ml-auto text-right text-[15px] font-semibold tabular-nums",
                      pnl >= 0 ? "text-term-up" : "text-term-down"
                    )}
                  >
                    <AnimatedNumber
                      value={pnl}
                      format={(n) =>
                        `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`
                      }
                    />{" "}
                    <span className="text-[12px] opacity-70">
                      (
                      <AnimatedNumber
                        value={roe}
                        format={(n) =>
                          `${n >= 0 ? "+" : "-"}${Math.abs(n).toFixed(1)}%`
                        }
                      />
                      )
                    </span>
                  </span>
                )}
              </div>

              {/* Detail — entry → mark · liq · size */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tabular-nums text-term-dim">
                <span>
                  entry{" "}
                  <span className="text-term-mid">
                    {p.entryPx ? fmtPrice(parseFloat(p.entryPx)) : "—"}
                  </span>
                </span>
                <span aria-hidden className="text-term-line">
                  →
                </span>
                <span>
                  mark{" "}
                  <span className="text-term-fg">
                    {live > 0 ? (
                      <AnimatedNumber value={live} format={(n) => fmtPrice(n)} />
                    ) : (
                      "—"
                    )}
                  </span>
                </span>
                <span>
                  liq{" "}
                  <span className="text-term-mid">
                    {p.liquidationPx ? fmtPrice(parseFloat(p.liquidationPx)) : "—"}
                  </span>
                </span>
                <span>
                  size <span className="text-term-mid">{usd(value)}</span>
                </span>
              </div>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  onClick={() =>
                    setShare({
                      coin: ticker(p.coin),
                      isLong,
                      leverage: lev,
                      entryPx: p.entryPx ? parseFloat(p.entryPx) : undefined,
                      markPx: m && m.markPx > 0 ? m.markPx : undefined,
                      pnlUsd: pnl,
                      pnlPct: roe,
                      realized: false,
                    })
                  }
                  disabled={pending}
                  className="border border-term-line px-2.5 py-1 text-[10px] uppercase tracking-wider text-term-fg hover:bg-black/5 disabled:opacity-40"
                  title="Share a P&L card"
                >
                  Share
                </button>
                <button
                  onClick={() => setExpanded(open ? null : p.coin)}
                  disabled={pending}
                  className={cn(
                    "border border-term-line px-2.5 py-1 text-[10px] uppercase tracking-wider disabled:opacity-40",
                    open ? "text-term-fg" : "text-term-mid hover:text-term-fg"
                  )}
                  title="Set a take-profit / stop-loss for this position"
                >
                  TP / SL
                </button>
                {[0.25, 0.5, 0.75, 1].map((frac) => (
                  <button
                    key={frac}
                    onClick={() => doClose(p.coin, frac)}
                    disabled={pending || busy === `${p.coin}:${frac}`}
                    className="border border-term-line px-2.5 py-1 text-[10px] uppercase tracking-wider text-term-mid hover:text-term-fg disabled:opacity-40"
                    title={
                      frac >= 1
                        ? "Close the entire position"
                        : `Close ${frac * 100}% of the position`
                    }
                  >
                    {busy === `${p.coin}:${frac}`
                      ? "…"
                      : frac >= 1
                      ? "Close all"
                      : `Close ${frac * 100}%`}
                  </button>
                ))}
              </div>

              {open && m && (
                <div className="mt-3 border-t border-term-line pt-3">
                  <TpSlRow
                    market={m}
                    isLong={isLong}
                    size={Math.abs(szi)}
                    leverage={lev}
                    onDone={() => {
                      setExpanded(null);
                      setTimeout(refresh, 700);
                    }}
                  />
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

function TpSlRow({
  market,
  isLong,
  size,
  leverage,
  onDone,
}: {
  market: Market;
  isLong: boolean;
  size: number;
  leverage: number;
  onDone: () => void;
}) {
  const { runL1 } = useAgent();
  const { notify } = useToast();
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const tpPrice = parseFloat(tp) || undefined;
    const slPrice = parseFloat(sl) || undefined;
    if (!tpPrice && !slPrice) return;
    setBusy(true);
    try {
      await runL1((signer) =>
        placeTpSlOrders({
          walletClient: signer,
          asset: market.index,
          isLong,
          size,
          leverage,
          szDecimals: market.szDecimals,
          tpPrice,
          slPrice,
        })
      );
      notify("ok", `TP/SL set for ${market.name}.`);
      onDone();
    } catch (e) {
      notify("err", `TP/SL failed: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 bg-black/[0.02] px-1 py-1.5 text-[10px]">
      <span className="uppercase tracking-wider text-term-dim">Take profit</span>
      <input
        value={tp}
        onChange={(e) => setTp(e.target.value)}
        inputMode="decimal"
        placeholder="price"
        className="h-6 flex-1 border border-term-line bg-transparent px-1.5 tabular-nums text-term-fg outline-none focus:border-term-mid sm:w-24 sm:flex-none"
      />
      <span className="uppercase tracking-wider text-term-dim">Stop loss</span>
      <input
        value={sl}
        onChange={(e) => setSl(e.target.value)}
        inputMode="decimal"
        placeholder="price"
        className="h-6 flex-1 border border-term-line bg-transparent px-1.5 tabular-nums text-term-fg outline-none focus:border-term-mid sm:w-24 sm:flex-none"
      />
      <button
        onClick={submit}
        disabled={busy}
        className="h-6 border border-term-line px-3 uppercase tracking-wider text-term-mid hover:text-term-fg disabled:opacity-40"
      >
        {busy ? "…" : "Set"}
      </button>
    </div>
  );
}
