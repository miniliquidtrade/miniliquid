"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { errMsg } from "@/lib/format";

/**
 * Explainer + launcher for exporting the embedded wallet's private key.
 * The key itself is revealed inside Privy's isolated iframe (our app never
 * sees it); this modal just sets expectations and security context first.
 */
export function ExportKey({ onClose }: { onClose: () => void }) {
  const { address, exportKey } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reveal = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportKey();
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[14vh]"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-[min(92vw,380px)] overflow-y-auto border border-term-line bg-term-bg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wider text-term-hi">
            Export wallet key
          </span>
          <button
            onClick={onClose}
            className="text-term-dim hover:text-term-fg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-4 space-y-2.5 text-[11px] leading-relaxed text-term-mid">
          <p>
            Your account runs on a self-custodial wallet created when you signed
            in. Exporting its <span className="text-term-fg">private key</span>{" "}
            lets you import this wallet into MetaMask, Rabby, or any other wallet
            — so you&apos;re never locked in and always in control of your funds.
          </p>
          <p className="border-l-2 border-term-line pl-2 text-term-dim">
            Anyone with this key has full control of the wallet and everything in
            it. Never share it or paste it into any site. We can never see it —
            it&apos;s shown in a secure Privy window, not by this app.
          </p>
          {address && (
            <p className="break-all text-[10px] text-term-dim">
              Wallet: <span className="text-term-fg">{address}</span>
            </p>
          )}
        </div>

        <button
          onClick={reveal}
          disabled={busy}
          className="mt-4 h-9 w-full bg-term-hi text-[11px] font-medium uppercase tracking-wider text-term-bg hover:bg-term-fg disabled:opacity-40"
        >
          {busy ? "Opening secure window…" : "Reveal private key"}
        </button>

        {error && (
          <p className="mt-2 break-words text-[10px] text-term-mid">✕ {error}</p>
        )}
      </div>
    </div>
  );
}
