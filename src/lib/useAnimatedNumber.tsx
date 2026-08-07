"use client";

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Smoothly tweens a number toward `value` (easeOutCubic). Falls back to the
// exact value instantly when the user prefers reduced motion.
export function useAnimatedNumber(value: number, duration = 450): number {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    displayRef.current = display;
  });

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(value)) {
      setDisplay(value);
      return;
    }
    const from = displayRef.current;
    if (from === value) return;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      if (t < 1) {
        setDisplay(from + (value - from) * eased);
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return prefersReducedMotion() ? value : display;
}

// Renders an animated number with a caller-supplied formatter.
export function AnimatedNumber({
  value,
  format,
  duration,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const n = useAnimatedNumber(value, duration);
  return <span className={className}>{format(n)}</span>;
}
