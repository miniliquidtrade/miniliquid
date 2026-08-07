"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useAccount } from "@/hooks/useAccount";
import { useToast } from "@/hooks/useToast";
import { withdraw } from "@/lib/hlExchange";
import { cn, errMsg } from "@/lib/format";

const MIN_WITHDRAW = 2; // HL charges a $1 fee; withdraw must exceed it

export function Withdraw({ onClose }: { onClose: () => void }) {
  const { address, walletClient } = useWallet();
  const { available: withdrawable } = useAccount();
  const { notify } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const amt = parseFloat(amount) || 0;
  const tooSmall = amount !== "" && amt < MIN_WITHDRAW;
  const tooBig = amt > withdrawable + 0.01;
  const validAmt = amt >= MIN_WITHDRAW && !tooBig;

  const submit = async () => {
    if (!amt || amt < MIN_WITHDRAW) {
      notify("err", `Minimum withdrawal is $${MIN_WITHDRAW}`);
      return;
    }
    if (tooBig) {
      notify("err", `You can withdraw up to $${withdrawable.toFixed(2)}`);
      return;
    }
    if (!walletClient || !address) return;
    setBusy(true);
    try {
      await withdraw({ walletClient, amount: amt.toFixed(2), destination: address });
      notify(
        "ok",
        `Withdrawing $${amt.toFixed(2)} to your wallet — arrives on Arbitrum in a few minutes (minus $1 fee).`
      );
      setAmount("");
      onClose();
      setTimeout(() => qc.invalidateQueries({ queryKey: ["clearinghouse"] }), 3000);
    } catch (e) {
      notify("err", `Withdraw failed: ${errMsg(e)}`);
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
        className="max-h-[80vh] w-[min(92vw,360px)] overflow-y-auto border border-term-line bg-term-bg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wider text-term-hi">
            Withdraw
          </span>
          <button
            onClick={onClose}
            className="text-term-dim hover:text-term-fg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-[10px] text-term-dim">
          <span className="uppercase tracking-wider">Amount (USDC)</span>
          <span>
            available{" "}
            <span className="tabular-nums text-term-fg">
              ${withdrawable.toFixed(2)}
            </span>
          </span>
        </div>
        <div className="mt-1.5">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-term-dim">
              $
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && validAmt && !busy) submit();
              }}
              inputMode="decimal"
              placeholder="0.00"
              className={cn(
                "h-8 w-full border bg-transparent pl-5 pr-2 text-[13px] tabular-nums text-term-fg outline-none",
                tooSmall || tooBig
                  ? "border-term-down"
                  : "border-term-line focus:border-term-mid"
              )}
            />
          </div>
          {withdrawable > 0 && (
            <div className="mt-1.5 flex gap-1.5">
              {[0.25, 0.5].map((f) => (
                <button
                  key={f}
                  onClick={() => setAmount((withdrawable * f).toFixed(2))}
                  className="border border-term-line px-1.5 py-0.5 text-[10px] tabular-nums text-term-mid hover:text-term-fg"
                >
                  {Math.round(f * 100)}%
                </button>
              ))}
              <button
                onClick={() => setAmount(withdrawable.toFixed(2))}
                className="border border-term-line px-1.5 py-0.5 text-[10px] uppercase tabular-nums text-term-mid hover:text-term-fg"
              >
                Max
              </button>
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={busy || !validAmt}
          className="mt-3 h-8 w-full bg-term-hi text-[11px] font-medium uppercase tracking-wider text-term-bg hover:bg-term-fg disabled:opacity-40"
        >
          {busy
            ? "Confirm in wallet…"
            : tooBig
            ? "Amount exceeds available"
            : tooSmall
            ? `Minimum $${MIN_WITHDRAW}`
            : "Withdraw to my wallet"}
        </button>
        <p className="mt-1 text-[9px] text-term-dim">
          Sends to your connected address on Arbitrum. $1 network fee, min $2,
          arrives in a few minutes.
        </p>
        {address && (
          <p className="mt-2 break-all text-[9px] text-term-dim">
            To: <span className="text-term-mid">{address}</span>
          </p>
        )}

        {/* Cashing out to a bank — done manually via an exchange. */}
        <div className="mt-3 border-t border-term-line pt-3">
          <p className="text-[9px] uppercase tracking-wider text-term-dim">
            Cashing out to your bank
          </p>
          <p className="mt-1 text-[9px] leading-relaxed text-term-mid">
            This withdraws <span className="text-term-fg">USDC on Arbitrum</span>{" "}
            to your wallet. To turn it into cash, send that USDC to an account
            that sells crypto for fiat — e.g.{" "}
            <span className="text-term-fg">Coinbase</span> or{" "}
            <span className="text-term-fg">Revolut</span> — and withdraw to your
            bank there. When depositing on the exchange, pick the{" "}
            <span className="text-term-fg">Arbitrum</span> network and the{" "}
            <span className="text-term-fg">USDC</span> asset. That step is done on
            their side, not here.
          </p>
        </div>
      </div>
    </div>
  );
}
