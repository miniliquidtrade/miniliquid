"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { cn } from "@/lib/format";

export interface TourStep {
  selector: string;
  title: string;
  body: string;
  /** Optional inline action (e.g. "Enable 1-click"). */
  action?: { label: string; done?: boolean; onClick: () => void };
}

const TIP_W = 300;

export function Tour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[i];

  const measure = useCallback(() => {
    const el = document.querySelector(step.selector);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [step.selector]);

  useLayoutEffect(() => {
    measure();
    const t = setTimeout(measure, 300); // re-measure after scroll settles
    return () => clearTimeout(t);
  }, [measure]);

  useEffect(() => {
    const on = () => measure();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
    };
  }, [measure]);

  const last = i === steps.length - 1;
  const next = () => (last ? onClose() : setI((v) => v + 1));
  const back = () => setI((v) => Math.max(0, v - 1));

  // Spotlight box (with a little padding around the target).
  const pad = 6;
  const box = rect
    ? {
        top: Math.max(4, rect.top - pad),
        left: Math.max(4, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Tooltip placement: below the target if there's room, else above; centered
  // on the target and clamped to the viewport.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const below = !box || box.top + box.height + 200 < vh;
  const tipTop = box
    ? below
      ? box.top + box.height + 10
      : Math.max(10, box.top - 10 - 150)
    : vh / 2 - 80;
  const tipLeft = box
    ? Math.min(Math.max(8, box.left + box.width / 2 - TIP_W / 2), vw - TIP_W - 8)
    : vw / 2 - TIP_W / 2;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Dim + spotlight cutout */}
      {box ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-1 ring-term-fg/40 transition-all duration-200"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      {/* Tooltip */}
      <div
        className="absolute border border-term-line bg-term-bg p-4 shadow-xl"
        style={{ top: tipTop, left: tipLeft, width: TIP_W }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium uppercase tracking-wider text-term-hi">
            {step.title}
          </p>
          <span className="text-[9px] tabular-nums text-term-dim">
            {i + 1}/{steps.length}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-term-mid">
          {step.body}
        </p>

        {step.action && (
          <button
            onClick={step.action.onClick}
            disabled={step.action.done}
            className={cn(
              "mt-3 h-8 w-full text-[11px] font-medium uppercase tracking-wider transition-colors",
              step.action.done
                ? "border border-term-line text-term-dim"
                : "bg-term-hi text-term-bg hover:bg-term-fg"
            )}
          >
            {step.action.done ? "Enabled ✓" : step.action.label}
          </button>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-[10px] uppercase tracking-wider text-term-dim hover:text-term-fg"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button
                onClick={back}
                className="border border-term-line px-3 py-1 text-[10px] uppercase tracking-wider text-term-mid hover:text-term-fg"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="bg-term-hi px-3 py-1 text-[10px] uppercase tracking-wider text-term-bg hover:bg-term-fg"
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
