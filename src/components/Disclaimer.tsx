"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";

// Bump the suffix if the acknowledgment text materially changes, so returning
// users are asked to accept the new version.
const ACK_KEY = "miniliquid_ack_v1";

/**
 * One-time, first-visit acknowledgment. Belt-and-suspenders alongside the
 * edge-level geoblock: the user must actively confirm they're eligible and
 * accept the risk before the app is usable. Stored locally in the browser, so
 * it shows once per device. Rendered only on the app (not the legal pages), so
 * Terms / Risk stay freely readable.
 */
export function Disclaimer() {
  // Start hidden to avoid an SSR/hydration flash; decide on mount.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ACK_KEY)) setOpen(true);
    } catch {
      // If storage is unavailable, show it anyway (fail-safe, not fail-open).
      setOpen(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(ACK_KEY, "1");
    } catch {
      /* ignore — worst case it shows again next visit */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ack-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md border border-term-line bg-term-bg p-5 shadow-xl sm:p-6">
        <Brand className="text-[13px]" />
        <h2
          id="ack-title"
          className="mt-4 font-mono text-lg font-semibold tracking-tight text-term-hi"
        >
          Before you start
        </h2>

        <div className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-term-mid">
          <p>
            <span className="text-term-fg">miniliquid</span> is a free,
            open-source, non-custodial interface for the Hyperliquid protocol. It
            is <span className="text-term-fg">not affiliated with</span>, endorsed
            by, or operated by Hyperliquid. It holds no keys and no funds and
            charges no fees.
          </p>
          <p>
            Trading perpetual futures is{" "}
            <span className="text-term-fg">highly risky</span> and can lose you
            everything. All trades are your own decisions and execute on a
            third-party protocol at your own risk.
          </p>
          <p>
            By continuing, you confirm you are{" "}
            <span className="text-term-fg">
              not a U.S. person and not located in a restricted or sanctioned
              jurisdiction
            </span>
            , that you are of legal age, and that you accept the{" "}
            <Link href="/terms" className="text-term-fg underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/risk" className="text-term-fg underline">
              Risk Disclosure
            </Link>
            .
          </p>
        </div>

        <button
          onClick={accept}
          className="mt-5 w-full bg-term-hi py-2.5 text-[12px] font-medium uppercase tracking-wider text-term-bg hover:bg-term-fg"
        >
          I understand &amp; agree
        </button>
        <a
          href="https://www.google.com"
          className="mt-2 block text-center text-[10px] uppercase tracking-wider text-term-dim hover:text-term-fg"
        >
          Leave
        </a>
      </div>
    </div>
  );
}
