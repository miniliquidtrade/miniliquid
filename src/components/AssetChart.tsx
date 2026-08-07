"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCandles } from "@/lib/hl";
import { smooth, type Pt } from "@/lib/chart";
import { fmtPrice, cn } from "@/lib/format";

const PERIODS = [
  { key: "1D", interval: "15m", ms: 24 * 3600e3 },
  { key: "1W", interval: "1h", ms: 7 * 24 * 3600e3 },
  { key: "1M", interval: "4h", ms: 30 * 24 * 3600e3 },
  { key: "12M", interval: "1d", ms: 365 * 24 * 3600e3 },
  { key: "All", interval: "1w", ms: 6 * 365 * 24 * 3600e3 },
] as const;

const W = 100;
const H = 40;
const PAD = 4;

function fmtTime(t: number): string {
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Compact price chart for a single market — same smooth, monochrome feel as
 * the account-value chart. Renders nothing if candle data isn't available, so
 * it degrades quietly for markets without history. Price change is kept
 * monochrome; green/red stays reserved for P&L.
 */
export function AssetChart({ coin }: { coin: string }) {
  const [pi, setPi] = useState(0);
  const period = PERIODS[pi];
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const gid = `ac-${coin.replace(/[^a-z0-9]/gi, "-")}`;

  const { data } = useQuery({
    queryKey: ["candles", coin, period.key],
    queryFn: () => getCandles(coin, period.interval, Date.now() - period.ms),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const series = useMemo(
    () =>
      (data ?? [])
        .map((c) => ({ t: c.t, v: parseFloat(c.c) }))
        .filter((p) => p.v > 0),
    [data]
  );

  const { stroke, area, pts } = useMemo(() => {
    if (series.length < 2) return { stroke: "", area: "", pts: [] as Pt[] };
    const vals = series.map((s) => s.v);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const p: Pt[] = series.map((s, i) => ({
      x: (i / (series.length - 1)) * W,
      y: PAD + (1 - (s.v - min) / span) * (H - 2 * PAD),
    }));
    const s = smooth(p);
    return { stroke: s, area: `${s} L${W},${H} L0,${H} Z`, pts: p };
  }, [series]);

  if (series.length < 2) return null;

  const last = series[series.length - 1].v;
  const first = series[0].v;
  const shownV = hover !== null && series[hover] ? series[hover].v : last;
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(frac * (series.length - 1)));
  };
  const hp = hover !== null && pts[hover] ? pts[hover] : null;

  return (
    <div className="mt-2 w-full border-t border-term-line/60 pt-2">
      <div className="flex items-center justify-between px-1 text-[9px] tabular-nums text-term-mid">
        <span>
          {hover !== null && series[hover] ? (
            <>
              <span className="text-term-fg">${fmtPrice(shownV)}</span>
              <span className="ml-2 text-term-dim">
                {fmtTime(series[hover].t)}
              </span>
            </>
          ) : (
            <>
              {period.key}{" "}
              <span className="text-term-fg">
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            </>
          )}
        </span>
        <div className="flex gap-2">
          {PERIODS.map((p, i) => (
            <button
              key={p.key}
              onClick={() => {
                setPi(i);
                setHover(null);
              }}
              className={cn(
                "uppercase tracking-wider transition-colors",
                i === pi ? "text-term-fg" : "text-term-dim hover:text-term-mid"
              )}
            >
              {p.key}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={ref}
        className="relative mt-1.5 h-24 w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full text-term-fg"
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.10" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
          <path
            d={stroke}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {hp && (
          <>
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-term-line"
              style={{ left: `${hp.x}%` }}
            />
            <div
              className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-term-fg"
              style={{ left: `${hp.x}%`, top: `${(hp.y / H) * 100}%` }}
            />
          </>
        )}
      </div>
    </div>
  );
}
