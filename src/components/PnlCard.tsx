"use client";

import { useEffect, useRef, useState } from "react";

export interface PnlCardData {
  coin: string; // ticker, already stripped of any dex prefix
  isLong: boolean;
  leverage?: number;
  entryPx?: number;
  markPx?: number; // current (open) or exit (realized) price
  pnlUsd: number;
  pnlPct?: number; // ROE %, when known
  realized?: boolean;
}

// Light, premium share card — matches the app's black-on-white look.
// Green/red still reserved for the P&L.
const D = {
  bgTop: "#ffffff",
  bgBottom: "#f4f4f5",
  line: "#e4e4e7",
  ink: "#141414",
  sub: "#5c5c63",
  dim: "#9a9aa2",
  up: "#12894a",
  down: "#d1453b",
  upGlow: "rgba(18,137,74,0.10)",
  downGlow: "rgba(209,69,59,0.10)",
  upSoft: "rgba(18,137,74,0.10)",
  downSoft: "rgba(209,69,59,0.10)",
  upEdge: "rgba(18,137,74,0.40)",
  downEdge: "rgba(209,69,59,0.40)",
};
const W = 640;
const H = 360;
const S = 2; // render at 2x for crispness
const R = 28; // corner radius

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function fmtPx(n?: number): string {
  if (!n || n <= 0) return "—";
  const digits = n >= 1000 ? 2 : n >= 1 ? 4 : 6;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

// The canonical domain shown on shared cards — not the deployment host (so
// preview/vercel URLs never leak onto a card). Overridable via env.
function host(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) {
    try {
      return new URL(env).host;
    } catch {
      return env.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }
  }
  return "miniliquid.trade";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(ctx: CanvasRenderingContext2D, d: PnlCardData) {
  const up = d.pnlUsd >= 0;
  const col = up ? D.up : D.down;
  const pad = 48;

  ctx.clearRect(0, 0, W, H);

  // Rounded light background with a subtle vertical gradient.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, D.bgTop);
  bg.addColorStop(1, D.bgBottom);
  roundRect(ctx, 0, 0, W, H, R);
  ctx.fillStyle = bg;
  ctx.fill();

  // Soft P&L-colored glow behind the hero, clipped to the card.
  roundRect(ctx, 0, 0, W, H, R);
  ctx.save();
  ctx.clip();
  const glow = ctx.createRadialGradient(pad + 130, 236, 12, pad + 130, 236, 300);
  glow.addColorStop(0, up ? D.upGlow : D.downGlow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Hairline border.
  roundRect(ctx, 0.75, 0.75, W - 1.5, H - 1.5, R - 1);
  ctx.strokeStyle = D.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Brand lockup: mL monogram · miniliquid //
  let brx = pad;
  ctx.fillStyle = D.ink;
  ctx.font = `700 22px ${MONO}`;
  ctx.fillText("mL", brx, 62);
  brx += ctx.measureText("mL").width + 11;
  ctx.font = `500 19px ${MONO}`;
  ctx.fillText("miniliquid", brx, 62);
  brx += ctx.measureText("miniliquid").width + 3;
  ctx.fillStyle = D.dim;
  ctx.fillText("//", brx, 62);

  // Side / leverage badge (top-right pill).
  const badge = `${d.isLong ? "LONG" : "SHORT"}${
    d.leverage ? `  ${Math.round(d.leverage)}×` : ""
  }`;
  ctx.font = `600 13px ${MONO}`;
  const bw = ctx.measureText(badge).width + 26;
  const bh = 28;
  const bx = W - pad - bw;
  const by = 40;
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fillStyle = up ? D.upSoft : D.downSoft;
  ctx.fill();
  ctx.strokeStyle = up ? D.upEdge : D.downEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.textAlign = "center";
  ctx.fillText(badge, bx + bw / 2, by + 19);
  ctx.textAlign = "left";

  // Ticker
  ctx.fillStyle = D.ink;
  ctx.font = `700 30px ${MONO}`;
  ctx.fillText(d.coin, pad, 134);

  // Hero — % when known (positions), else realized $ (history).
  const hero =
    d.pnlPct != null
      ? `${up ? "+" : "-"}${Math.abs(d.pnlPct).toFixed(2)}%`
      : `${up ? "+" : "-"}$${Math.abs(d.pnlUsd).toFixed(2)}`;
  ctx.font = `800 92px ${MONO}`;
  ctx.fillStyle = col;
  ctx.shadowColor = up ? D.upGlow : D.downGlow;
  ctx.shadowBlur = 14;
  ctx.fillText(hero, pad, 250);
  ctx.shadowBlur = 0;

  // Entry → mark/exit
  if (d.entryPx || d.markPx) {
    ctx.fillStyle = D.sub;
    ctx.font = `500 15px ${MONO}`;
    const label = d.realized ? "Exit" : "Mark";
    ctx.fillText(
      `Entry ${fmtPx(d.entryPx)}     →     ${label} ${fmtPx(d.markPx)}`,
      pad,
      294
    );
  }

  // Footer
  ctx.fillStyle = D.dim;
  ctx.font = `500 13px ${MONO}`;
  ctx.fillText(`trade on ${host()}`, pad, H - 32);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function PnlCard({
  data,
  onClose,
}: {
  data: PnlCardData;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W * S;
    canvas.height = H * S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(S, S);

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      draw(ctx, data);
      return;
    }

    // Count the hero figure up from zero as the card reveals.
    let raf = 0;
    let start = 0;
    const DUR = 620;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / DUR);
      const eased = 1 - Math.pow(1 - t, 3);
      draw(ctx, {
        ...data,
        pnlUsd: data.pnlUsd * eased,
        pnlPct: data.pnlPct != null ? data.pnlPct * eased : undefined,
      });
      if (t < 1) raf = requestAnimationFrame(step);
      else draw(ctx, data);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [data]);

  const copyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas);
    if (!blob) return;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setStatus("Image copied — paste it anywhere.");
        return;
      }
      throw new Error("no clipboard image support");
    } catch {
      // Fallback: download the PNG.
      download(blob);
      setStatus("Image downloaded.");
    }
  };

  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `miniliquid-${data.coin}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const shareX = async () => {
    // Copy the image first so the user can paste it into the post (X's compose
    // intent can't attach an image via URL).
    await copyImage();
    const up = data.pnlUsd >= 0;
    const headline =
      data.pnlPct != null
        ? `${up ? "+" : ""}${data.pnlPct.toFixed(1)}%`
        : `${up ? "+" : "-"}$${Math.abs(data.pnlUsd).toFixed(2)}`;
    const text = `${headline} on $${data.coin} ${
      data.isLong ? "long" : "short"
    }${data.leverage ? ` ${Math.round(data.leverage)}×` : ""} — trading on miniliquid`;
    // Link to the canonical domain, not the deployment host.
    const site = `https://${host()}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(site)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setStatus("Card copied — paste it into your post.");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="card-in w-[min(92vw,460px)] border border-term-line bg-term-bg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wider text-term-hi">
            Share P&amp;L
          </span>
          <button
            onClick={onClose}
            className="text-term-dim hover:text-term-fg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-3 overflow-hidden border border-term-line">
          <canvas
            ref={canvasRef}
            className="block h-auto w-full"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={copyImage}
            className="h-8 flex-1 bg-term-hi text-[11px] font-medium uppercase tracking-wider text-term-bg hover:bg-term-fg"
          >
            Copy image
          </button>
          <button
            onClick={shareX}
            className="h-8 flex-1 border border-term-line text-[11px] uppercase tracking-wider text-term-fg hover:bg-black/5"
          >
            Share on X
          </button>
        </div>
        {status && (
          <p className="mt-2 text-[10px] text-term-mid">{status}</p>
        )}
      </div>
    </div>
  );
}
