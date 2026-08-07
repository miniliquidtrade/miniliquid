"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { PRIVY_APP_SPONSORS_GAS } from "@/lib/privy";
import { cn, errMsg } from "@/lib/format";

// Hyperliquid Arbitrum bridge (deposit by sending native USDC here, min $5).
const HL_BRIDGE = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
const USDC_ARBITRUM = "0xaf88d065e77c8cc2239327c5edb3a432268e5831"; // native USDC
const USDC_E_ARBITRUM = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"; // bridged USDC.e
const ARB_RPC = "https://arb1.arbitrum.io/rpc";
const MIN_DEPOSIT = 5;
// USDC held back so the ERC-20 gas paymaster can take its fee when the embedded
// wallet pays its own gas (comfortably covers an Arbitrum transfer's fee).
const GAS_BUFFER_USDC = 0.25;

function pad32(hexNo0x: string) {
  return hexNo0x.padStart(64, "0");
}

// Small numbered step indicator — checks off (filled) when the step is done,
// outlines when it's the next action, faint otherwise.
function StepBadge({
  n,
  done,
  active,
}: {
  n: number;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-medium tabular-nums",
        done
          ? "border-term-hi bg-term-hi text-term-bg"
          : active
          ? "border-term-fg text-term-fg"
          : "border-term-line text-term-dim"
      )}
    >
      {done ? "✓" : n}
    </span>
  );
}

async function rpc(method: string, params: unknown[]): Promise<string | null> {
  try {
    const r = await fetch(ARB_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const j = await r.json();
    return typeof j.result === "string" ? j.result : null;
  } catch {
    return null;
  }
}

async function readUsdc(token: string, owner: string): Promise<number | null> {
  const data = "0x70a08231" + pad32(owner.slice(2).toLowerCase());
  const res = await rpc("eth_call", [{ to: token, data }, "latest"]);
  if (res === null) return null;
  return res ? parseInt(res, 16) / 1e6 : 0;
}

export function AddMoney({ onClose }: { onClose: () => void }) {
  const { address, sendTransaction, canFundWithCard, fundWithCard } = useWallet();
  const { notify } = useToast();
  const qc = useQueryClient();

  const [onchain, setOnchain] = useState<number | null>(null); // native USDC
  const [onchainE, setOnchainE] = useState<number | null>(null); // USDC.e
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"deposit" | "fund" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState<"addr" | "bridge" | null>(null);

  // Keep the on-chain (Arbitrum) balances live: native USDC (depositable) and
  // USDC.e (needs swapping).
  useEffect(() => {
    if (!address) return;
    let stop = false;
    const tick = () => {
      readUsdc(USDC_ARBITRUM, address).then((v) => !stop && setOnchain(v));
      readUsdc(USDC_E_ARBITRUM, address).then((v) => !stop && setOnchainE(v));
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [address]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["clearinghouse"] });
    qc.invalidateQueries({ queryKey: ["spot"] });
  };

  const copy = (text: string, which: "addr" | "bridge") => {
    navigator.clipboard?.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  // Step 1 (embedded wallets): buy USDC on Arbitrum into the wallet via card
  // or transfer. The balance poll picks it up and enables Step 2.
  const buyWithCard = async () => {
    const amt = parseFloat(amount);
    const preset = amt && amt >= 1 ? amt.toFixed(2) : "50";
    setBusy("fund");
    setStatus(null);
    try {
      await fundWithCard(preset);
      if (address) readUsdc(USDC_ARBITRUM, address).then(setOnchain);
      setStatus({
        ok: true,
        msg: "USDC added to your wallet. Once it lands, tap “Move to Hyperliquid” below to start trading.",
      });
    } catch (e) {
      setStatus({ ok: false, msg: errMsg(e) });
    } finally {
      setBusy(null);
    }
  };

  // Core: forward native USDC from the connected wallet to the HL bridge.
  const doDeposit = async (amt: number) => {
    setBusy("deposit");
    setStatus(null);
    try {
      const units = BigInt(Math.floor(amt * 1e6)).toString(16);
      const data =
        "0xa9059cbb" + pad32(HL_BRIDGE.slice(2).toLowerCase()) + pad32(units);
      await sendTransaction({ to: USDC_ARBITRUM, data });
      notify(
        "ok",
        `Deposit of $${amt.toFixed(2)} submitted — it'll land in your account any moment (~1 min).`
      );
      setAmount("");
      onClose();
      setTimeout(refresh, 15000);
    } catch (e) {
      const raw = errMsg(e);
      const noGas = /insufficient funds|gas required|exceeds balance|intrinsic/i.test(
        raw
      );
      const msg = noGas && !canFundWithCard
        ? "Your wallet needs a small amount of Arbitrum ETH to cover the network fee before it can move funds to Hyperliquid. Add a little ETH (Arbitrum) to your wallet, then try again."
        : /500|status code|internal/i.test(raw)
        ? `${raw} — usually a temporary wallet/RPC hiccup. Confirm you're on Arbitrum and try again.`
        : raw;
      setStatus({ ok: false, msg });
    } finally {
      setBusy(null);
    }
  };

  // Injected wallets: deposit the typed amount (they already hold USDC + gas).
  const deposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < MIN_DEPOSIT) {
      setStatus({ ok: false, msg: `Minimum deposit is $${MIN_DEPOSIT}` });
      return;
    }
    if (onchain !== null && amt > onchain + 0.01) {
      setStatus({
        ok: false,
        msg:
          onchainE && onchainE > onchain
            ? `You only hold $${onchain.toFixed(2)} native USDC. Your $${onchainE.toFixed(2)} is USDC.e — swap it to native USDC first (the bridge won't accept USDC.e).`
            : `You only have $${onchain.toFixed(2)} native USDC on Arbitrum.`,
      });
      return;
    }
    await doDeposit(amt);
  };

  const usdc = onchain ?? 0;
  // When the embedded wallet pays its own gas in USDC (default), the paymaster
  // needs a little USDC left over for the fee — so we can't move 100%. Injected
  // wallets pay gas in ETH, and the app-sponsored mode has the app cover it, so
  // neither needs the buffer.
  const userPaysGas = canFundWithCard && !PRIVY_APP_SPONSORS_GAS;
  const depositAmt = userPaysGas ? Math.max(0, usdc - GAS_BUFFER_USDC) : usdc;
  const canDeposit = depositAmt >= MIN_DEPOSIT;
  // Step 1 is "done" once enough USDC has landed in the wallet to move on.
  const step1Done = onchain !== null && usdc >= MIN_DEPOSIT;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[14vh]"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-[min(92vw,360px)] overflow-y-auto border border-term-line bg-term-bg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wider text-term-hi">
            Add money
          </span>
          <button
            onClick={onClose}
            className="text-term-dim hover:text-term-fg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {canFundWithCard ? (
          /* ── Embedded (email / social) wallet: two clear steps ──────────── */
          <>
            {/* Step 1 — get USDC into the account wallet */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-term-hi">
                  <StepBadge n={1} done={step1Done} active={!step1Done} />
                  Add USDC to your wallet
                </span>
                <span className="text-term-dim">
                  in wallet{" "}
                  <span className="tabular-nums text-term-fg">
                    {onchain === null ? "…" : `$${usdc.toFixed(2)}`}
                  </span>
                </span>
              </div>

              <button
                onClick={buyWithCard}
                disabled={busy === "fund"}
                className="mt-2 h-9 w-full bg-term-hi text-[11px] font-medium uppercase tracking-wider text-term-bg hover:bg-term-fg disabled:opacity-40"
              >
                {busy === "fund" ? "Opening…" : "Buy USDC — card or transfer"}
              </button>

              <div className="my-2 flex items-center gap-2 text-[8px] uppercase tracking-wider text-term-dim">
                <span className="h-px flex-1 bg-term-line" />
                or send USDC to your address
                <span className="h-px flex-1 bg-term-line" />
              </div>

              <div className="flex items-center gap-2">
                <span className="break-all text-[10px] tabular-nums text-term-fg">
                  {address}
                </span>
                <button
                  onClick={() => address && copy(address, "addr")}
                  className="shrink-0 border border-term-line px-1.5 py-0.5 text-[9px] uppercase text-term-mid hover:text-term-fg"
                >
                  {copied === "addr" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-[9px] text-term-dim">
                Send <span className="text-term-mid">native USDC on Arbitrum</span>{" "}
                only. Anything else won&apos;t show up.
              </p>
            </div>

            {/* Step 2 — move it onto Hyperliquid (gas paid from USDC) */}
            <div className="mt-4 border-t border-term-line pt-3">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-term-hi">
                <StepBadge n={2} active={canDeposit} />
                Move to Hyperliquid
                {canDeposit && (
                  <span className="ml-1 rounded-full border border-term-fg px-1.5 text-[8px] tracking-wider text-term-fg">
                    Ready
                  </span>
                )}
              </span>
              <button
                onClick={() => doDeposit(depositAmt)}
                disabled={busy === "deposit" || !canDeposit}
                className="mt-2 h-9 w-full bg-term-hi text-[11px] font-medium uppercase tracking-wider text-term-bg hover:bg-term-fg disabled:opacity-40"
              >
                {busy === "deposit"
                  ? "Moving to Hyperliquid…"
                  : canDeposit
                  ? `Move $${depositAmt.toFixed(2)} to Hyperliquid`
                  : "Waiting for funds…"}
              </button>
              <p className="mt-1 text-[9px] text-term-dim">
                One tap — no ETH needed. Ready to trade in ~1 min. Your money
                isn&apos;t on Hyperliquid until you do this.
              </p>
              {userPaysGas && usdc > depositAmt && canDeposit && (
                <p className="mt-1 text-[9px] text-term-mid">
                  Why not the full ${usdc.toFixed(2)}? We move ${depositAmt.toFixed(2)}{" "}
                  and leave ~${(usdc - depositAmt).toFixed(2)} in your wallet to
                  pay the tiny network fee (so you never need ETH). Anything left
                  over stays in your wallet for next time.
                </p>
              )}
            </div>
          </>
        ) : (
          /* ── Injected wallet: already holds USDC + gas, single step ──────── */
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] text-term-dim">
              <span className="uppercase tracking-wider">Deposit USDC (Arbitrum)</span>
              <span>
                on-chain{" "}
                <span className="text-term-fg tabular-nums">
                  {onchain === null ? "…" : `$${usdc.toFixed(2)}`}
                </span>
              </span>
            </div>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-term-dim">
                  $
                </span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-8 w-full border border-term-line bg-transparent pl-5 pr-2 text-[13px] tabular-nums text-term-fg outline-none focus:border-term-mid"
                />
              </div>
              {onchain !== null && onchain > 0 && (
                <button
                  onClick={() => setAmount(usdc.toFixed(2))}
                  className="h-8 border border-term-line px-2 text-[10px] uppercase text-term-dim hover:text-term-fg"
                >
                  Max
                </button>
              )}
            </div>
            <button
              onClick={deposit}
              disabled={busy === "deposit"}
              className="mt-2 h-8 w-full bg-term-hi text-[11px] font-medium uppercase tracking-wider text-term-bg hover:bg-term-fg disabled:opacity-40"
            >
              {busy === "deposit" ? "Confirm in wallet…" : "Deposit to Hyperliquid"}
            </button>
            <p className="mt-1 text-[9px] text-term-dim">
              Sends native USDC to the HL bridge on Arbitrum. One wallet
              confirmation. Min $5.
            </p>
            {onchainE !== null && onchainE >= 1 && usdc < onchainE && (
              <p className="mt-1 text-[9px] text-term-mid">
                Note: you hold ${onchainE.toFixed(2)} USDC.e — the bridge only
                accepts native USDC, so swap it first.
              </p>
            )}
          </div>
        )}

        {status && (
          <p
            className={cn(
              "mt-3 break-words text-[10px]",
              status.ok ? "text-term-hi" : "text-term-mid"
            )}
          >
            {status.ok ? "✓ " : "✕ "}
            {status.msg}
          </p>
        )}

        {/* Manual fallback for injected wallets whose in-app popup errors. */}
        {!canFundWithCard && (
          <div className="mt-3 border-t border-term-line pt-3">
            <p className="text-[9px] text-term-dim">
              Popup erroring? Deposit manually: from your wallet, send{" "}
              <span className="text-term-mid">native USDC on Arbitrum</span> (min
              $5) to the Hyperliquid bridge:
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="break-all text-[10px] tabular-nums text-term-fg">
                {HL_BRIDGE}
              </span>
              <button
                onClick={() => copy(HL_BRIDGE, "bridge")}
                className="shrink-0 border border-term-line px-1.5 py-0.5 text-[9px] uppercase text-term-mid hover:text-term-fg"
              >
                {copied === "bridge" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1 text-[9px] text-term-mid">
              Funds credit the wallet you send from — send from your connected
              address.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
