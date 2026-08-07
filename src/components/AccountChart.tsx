"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPortfolio } from "@/lib/hl";
import { useWallet } from "@/hooks/useWallet";
import { smooth, type Pt } from "@/lib/chart";
import { cn } from "@/lib/format";

const PERIODS: { key: string; label: string }[] = [
  { key: "day", label: "1D" },
  { key: "week", label: "1W" },
  { key: "month", label: "1M" },
  // 12M isn't a native portfolio window — derived from allTime, last 365 days.
  { key: "year", label: "12M" },
  { key: "allTime", label: "All" },
];

const YEAR_MS = 365 * 24 * 3600e3;

const W = 100;
const H = 48;
const PAD = 6;

function fmtTime(t: number): string {
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AccountChart() {
  const { address } = useWallet();
  const [period, setPeriod] = useState("week");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["portfolio", address],
    queryFn: () => getPortfolio(address!),
    enabled: !!address,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const series = useMemo(() => {
    // 12M reuses the allTime history, trimmed to the last year.
    const src = period === "year" ? "allTime" : period;
    const win = data?.find(([name]) => name === src);
    let hist = win?.[1]?.accountValueHistory ?? [];
    if (period === "year") {
      const cutoff = Date.now() - YEAR_MS;
      hist = hist.filter(([t]) => t >= cutoff);
    }
    return hist.map(([t, v]) => ({ t, v: parseFloat(v) }));
  }, [data, period]);

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

  if (!address) return null;

  const current = series.length ? series[series.length - 1].v : 0;
  const first = series.length ? series[0].v : 0;
  // When hovering, headline reflects the hovered point instead of the latest.
  const shownV = hover !== null && series[hover] ? series[hover].v : current;
  const change = shownV - first;
  const pct = first > 0 ? (change / first) * 100 : 0;
  const up = change >= 0;

  const onMove = (e: React.MouseEvent) => {
    if (!svgRef.current || series.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(frac * (series.length - 1)));
  };

  const hp = hover !== null && pts[hover] ? pts[hover] : null;

  return (
    <div className="pt-1">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 px-1">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-wider text-term-dim">
            Account value
          </div>
          <div className="mt-0.5 text-lg font-light tabular-nums text-term-hi sm:text-2xl">
            ${shownV.toFixed(2)}
          </div>
          <div
            className={cn(
              "text-[11px] tabular-nums",
              up ? "text-term-up" : "text-term-down"
            )}
          >
            {up ? "▲" : "▼"} {up ? "+" : "-"}${Math.abs(change).toFixed(2)} (
            {up ? "+" : ""}
            {pct.toFixed(2)}%)
            {hover !== null && series[hover] && (
              <span className="ml-2 text-term-dim">
                · {fmtTime(series[hover].t)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setPeriod(p.key);
                setHover(null);
              }}
              className={cn(
                "text-[9px] uppercase tracking-wider transition-colors",
                period === p.key
                  ? "text-term-fg"
                  : "text-term-dim hover:text-term-mid"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {stroke ? (
        <div
          ref={svgRef}
          className="relative mt-3 h-24 w-full cursor-crosshair"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-full w-full text-term-fg"
          >
            <defs>
              <linearGradient id="acctFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.13" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#acctFill)" />
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

          {/* Hover crosshair + dot */}
          {hp && (
            <>
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-term-line"
                style={{ left: `${hp.x}%` }}
              />
              <div
                className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-term-fg"
                style={{ left: `${hp.x}%`, top: `${(hp.y / H) * 100}%` }}
              />
            </>
          )}
        </div>
      ) : (
        <p className="mt-3 px-1 text-[10px] text-term-dim">
          No account history yet.
        </p>
      )}
    </div>
  );
}
