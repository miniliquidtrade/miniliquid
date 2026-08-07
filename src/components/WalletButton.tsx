"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@/hooks/useWallet";
import { useAgent } from "@/hooks/useAgent";
import { cn } from "@/lib/format";

const ExportKey = dynamic(
  () => import("@/components/ExportKey").then((m) => m.ExportKey),
  { ssr: false }
);

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletButton() {
  const {
    address,
    wallet,
    wallets,
    source,
    connect,
    loginWithPrivy,
    privyEnabled,
    privyReady,
    disconnect,
    connecting,
    error,
    canExportKey,
  } = useWallet();
  const { active: agentActive, enable, disable } = useAgent();
  const [open, setOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss the dropdown on outside-click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (address) {
    const label =
      source === "privy" ? "Email / social account" : wallet?.name ?? "Wallet";
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 border border-term-line px-2 py-1 text-[10px] text-term-fg hover:bg-black/5"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-term-hi" />
          <span className="tabular-nums">{short(address)}</span>
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-1 w-48 border border-term-line bg-term-panel p-1 text-[10px]">
            <div className="px-2 py-1 text-term-dim">{label}</div>
            <button
              onClick={() => {
                agentActive ? disable() : enable();
                setOpen(false);
              }}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-left uppercase tracking-wider text-term-mid hover:bg-black/5 hover:text-term-fg"
              title="One-click trading — approve once, trade with no confirmation on each order (can trade but never withdraw)"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  agentActive ? "bg-term-hi" : "bg-term-dim"
                )}
              />
              {agentActive ? "1-click: on — disable" : "1-click: off — enable"}
            </button>
            {canExportKey && (
              <button
                onClick={() => {
                  setShowExport(true);
                  setOpen(false);
                }}
                className="w-full px-2 py-1 text-left uppercase tracking-wider text-term-mid hover:bg-black/5 hover:text-term-fg"
                title="Export your wallet's private key to move it to another wallet"
              >
                Export wallet key
              </button>
            )}
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="w-full px-2 py-1 text-left uppercase tracking-wider text-term-mid hover:bg-black/5 hover:text-term-fg"
            >
              {source === "privy" ? "Log out" : "Disconnect"}
            </button>
          </div>
        )}
        {showExport && <ExportKey onClose={() => setShowExport(false)} />}
      </div>
    );
  }

  // A menu is worthwhile whenever there's more than one choice — multiple
  // injected wallets, or the email/social option alongside a wallet.
  const showMenu = wallets.length > 1 || (privyEnabled && wallets.length >= 1);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => {
          if (showMenu) setOpen((o) => !o);
          else if (wallets.length >= 1) connect(wallets[0].rdns);
          else if (privyEnabled) loginWithPrivy();
          else connect("injected");
        }}
        disabled={connecting}
        className={cn(
          "border border-term-line px-2.5 py-1 text-[10px] uppercase tracking-wider text-term-fg hover:bg-black/5 disabled:opacity-40"
        )}
      >
        {connecting ? "Connecting…" : "Connect"}
      </button>
      {open && showMenu && (
        <div className="absolute right-0 z-50 mt-1 w-56 border border-term-line bg-term-panel p-1">
          {privyEnabled && (
            <>
              <button
                onClick={() => {
                  loginWithPrivy();
                  setOpen(false);
                }}
                disabled={!privyReady}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] text-term-fg hover:bg-black/5 disabled:opacity-40"
              >
                <span className="flex h-4 w-4 items-center justify-center border border-term-line text-[9px]">
                  @
                </span>
                Continue with email or Google
              </button>
              {wallets.length > 0 && (
                <div className="my-1 flex items-center gap-2 px-2 text-[8px] uppercase tracking-wider text-term-dim">
                  <span className="h-px flex-1 bg-term-line" />
                  or a wallet
                  <span className="h-px flex-1 bg-term-line" />
                </div>
              )}
            </>
          )}
          {wallets.map((w) => (
            <button
              key={w.rdns}
              onClick={() => {
                connect(w.rdns);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] text-term-fg hover:bg-black/5"
            >
              {w.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.icon} alt="" className="h-4 w-4" />
              ) : (
                <span className="h-4 w-4 border border-term-line" />
              )}
              {w.name}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="absolute right-0 z-50 mt-1 w-52 border border-term-line bg-term-panel px-2 py-1 text-[9px] text-term-mid">
          {error}
        </div>
      )}
    </div>
  );
}
