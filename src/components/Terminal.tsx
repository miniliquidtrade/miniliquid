"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMarkets, type Market } from "@/hooks/useMarkets";
import { useAccount } from "@/hooks/useAccount";
import { useWallet } from "@/hooks/useWallet";
import { useAgent } from "@/hooks/useAgent";
import { useToast } from "@/hooks/useToast";
import { TradeLine } from "@/components/TradeLine";
import { Positions } from "@/components/Positions";
import { WalletButton } from "@/components/WalletButton";
import { Brand } from "@/components/Brand";
import { Disclaimer } from "@/components/Disclaimer";
import { SITE } from "@/lib/site";
import { AnimatedNumber } from "@/lib/useAnimatedNumber";
import type { TourStep } from "@/components/Tour";
import { cn } from "@/lib/format";

// On-demand UI — kept out of the initial bundle and loaded when first shown.
const AccountChart = dynamic(
  () => import("@/components/AccountChart").then((m) => m.AccountChart),
  { ssr: false }
);
const AddMoney = dynamic(
  () => import("@/components/AddMoney").then((m) => m.AddMoney),
  { ssr: false }
);
const Withdraw = dynamic(
  () => import("@/components/Withdraw").then((m) => m.Withdraw),
  { ssr: false }
);
const Tour = dynamic(() => import("@/components/Tour").then((m) => m.Tour), {
  ssr: false,
});

const TOUR_KEY = "hlterm_tour_seen";

const MAX_RESULTS = 20;

// Known commodity tickers, so we can guarantee a category mix in Popular.
// Everything on a non-main DEX that isn't a commodity is treated as a stock.
const COMMODITIES = new Set([
  "GOLD", "XAU", "SILVER", "XAG", "PLATINUM", "XPT", "PALLADIUM", "XPD",
  "OIL", "WTI", "CRUDE", "BRENT", "NATGAS", "NGAS", "GAS", "COPPER", "HG",
]);

function category(m: Market): "crypto" | "commodity" | "stock" {
  if (COMMODITIES.has(m.name.toUpperCase())) return "commodity";
  return m.dex === "" ? "crypto" : "stock";
}

export function Terminal() {
  const { markets, isLoading } = useMarkets();
  const { address, source } = useWallet();
  const { accountValue, spotUsdc, available } = useAccount();
  // Total equity, correct for both account modes WITHOUT double-counting.
  // These two figures overlap rather than add up, so we take the max:
  //  - Standard: funds sit in perp → accountValue is the equity (spot ~0).
  //  - Unified: the full equity (margin + unrealized P&L + free cash) reports
  //    under the spot/unified balance, while accountValue is only the perp
  //    subset. Summing them counted unrealized P&L twice when a position was
  //    open; max() picks the true total.
  const balance = Math.max(accountValue, spotUsdc);
  const { active: agentActive, enabling, enable, disable, error: agentError } =
    useAgent();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // First-time guided tour — shows once, the first time a wallet connects.
  useEffect(() => {
    if (!address) return;
    if (typeof window === "undefined" || localStorage.getItem(TOUR_KEY)) return;
    const t = setTimeout(() => setShowTour(true), 700);
    return () => clearTimeout(t);
  }, [address]);
  const closeTour = () => {
    setShowTour(false);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* ignore */
    }
  };
  const tourSteps: TourStep[] = [
    {
      selector: '[data-tour="funds"]',
      title: source === "privy" ? "1 · Fund your account" : "1 · Add money",
      body:
        source === "privy"
          ? "Start here. Tap Add money to buy USDC with a card — or send USDC to your wallet — then one tap moves it onto Hyperliquid to trade. Withdraw sends funds back out anytime."
          : "Start here. Deposit USDC from Arbitrum, or withdraw back to your wallet. Your balance shows to the left.",
    },
    {
      selector: '[data-tour="oneclick"]',
      title: "2 · One-click trading",
      body: "With funds in your account, approve once and your trades sign instantly — no confirmation step on every order. The trading key can place trades but can NEVER withdraw or move your funds. We recommend leaving it on.",
      action: {
        label: "Enable 1-click",
        done: agentActive,
        onClick: () => {
          if (!agentActive) enable();
        },
      },
    },
    {
      selector: '[data-tour="search"]',
      title: "3 · Search any market",
      body: "Type a ticker — BTC, ETH, SOL, NVDA, GOLD and hundreds more — to pull up its market. Then set leverage, enter an amount, and hit Long or Short.",
    },
    {
      selector: '[data-tour="account"]',
      title: "Your account",
      body: "Your account-value curve and open positions live here — with live P&L, estimated liquidation price, and one-tap close.",
    },
  ];

  // Keep the type bar focused — it's the primary surface.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Surface 1-click activation result (its failure was previously invisible).
  const prevActive = useRef(agentActive);
  useEffect(() => {
    if (agentActive && !prevActive.current) {
      notify("ok", "1-click enabled — orders now sign instantly, no confirmation needed.");
    }
    prevActive.current = agentActive;
  }, [agentActive, notify]);
  useEffect(() => {
    if (agentError) notify("err", `1-click couldn't be enabled: ${agentError}`);
  }, [agentError, notify]);

  // Popular chips — the most liquid markets (24h volume + open interest),
  // balanced so crypto, stocks and commodities are all represented.
  const popular = useMemo(() => {
    const tradable = markets.filter(
      (m) => m.volume24h > 0 && m.openInterest > 0
    );
    const score = (m: Market) => m.volume24h + m.openInterest;
    const buckets: Record<string, Market[]> = {
      crypto: [],
      stock: [],
      commodity: [],
    };
    for (const m of tradable) buckets[category(m)].push(m);
    for (const k in buckets) buckets[k].sort((a, b) => score(b) - score(a));

    // Guarantee a mix, then backfill from the deepest bucket (crypto).
    const pick = [
      ...buckets.crypto.slice(0, 6),
      ...buckets.stock.slice(0, 3),
      ...buckets.commodity.slice(0, 3),
    ];
    const chosen = new Set(pick.map((m) => m.coin));
    for (const m of buckets.crypto.slice(6)) {
      if (pick.length >= 12) break;
      if (!chosen.has(m.coin)) {
        pick.push(m);
        chosen.add(m.coin);
      }
    }
    // Present the row ranked by liquidity.
    return pick.sort((a, b) => score(b) - score(a)).slice(0, 12);
  }, [markets]);

  // Stable so memoized TradeLine rows don't re-render when the callback would
  // otherwise change identity every render.
  const handlePlaced = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return markets
      .filter((m) => m.volume24h > 0 && m.openInterest > 0)
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) || m.coin.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // Exact ticker match first, then by 24h volume.
        const ae = a.name.toLowerCase() === q ? 1 : 0;
        const be = b.name.toLowerCase() === q ? 1 : 0;
        if (ae !== be) return be - ae;
        return b.volume24h - a.volume24h;
      })
      .slice(0, MAX_RESULTS);
  }, [markets, query]);

  return (
    <div className="min-h-screen bg-term-bg">
      {/* Slim header */}
      <header className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Brand className="text-[13px]" />
          {/* Open-source badge — the project is public and MIT-licensed. */}
          <a
            href={SITE.github}
            target="_blank"
            rel="noreferrer noopener"
            title="miniliquid is open-source — view the code on GitHub"
            aria-label="View the source on GitHub"
            className="text-term-dim transition-colors hover:text-term-fg"
          >
            <svg
              viewBox="0 0 16 16"
              width="15"
              height="15"
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {address && (
            <>
              <span
                className="text-[10px] text-term-dim"
                title="Total account value (perp + spot / unified balance)"
              >
                Balance{" "}
                <AnimatedNumber
                  value={balance}
                  format={(n) => `$${n.toFixed(2)}`}
                  className="tabular-nums text-term-fg"
                />
              </span>
              <span
                className="hidden text-[10px] text-term-dim sm:inline"
                title="Free collateral available to open trades or withdraw"
              >
                Available{" "}
                <AnimatedNumber
                  value={available}
                  format={(n) => `$${n.toFixed(2)}`}
                  className="tabular-nums text-term-fg"
                />
              </span>
              {/* One-click trading — shown until enabled (the tour highlights
                  it and can turn it on); afterwards it lives in the wallet menu. */}
              {(!agentActive || showTour) && (
              <div data-tour="oneclick" className="group relative">
                <button
                  onClick={() => (agentActive ? disable() : enable())}
                  disabled={enabling}
                  className={cn(
                    "flex items-center gap-1 border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors disabled:opacity-40",
                    agentActive
                      ? "border-term-fg text-term-fg"
                      : "border-term-line text-term-dim hover:text-term-fg"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      agentActive ? "bg-term-hi" : "bg-term-dim"
                    )}
                  />
                  {enabling ? "Enabling…" : agentActive ? "1-click on" : "1-click"}
                </button>
                <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden w-64 border border-term-line bg-term-panel p-2.5 text-[10px] leading-relaxed text-term-mid group-hover:block group-focus-within:block">
                  <p className="mb-1 font-medium uppercase tracking-wider text-term-fg">
                    One-click trading {agentActive ? "· on" : "· off"}
                  </p>
                  Approve once, then your trades sign instantly — no confirmation
                  step on every order. The trading key can place trades but{" "}
                  <span className="text-term-fg">never withdraw or move your funds</span>
                  . Turn it off anytime; withdrawals always need your approval.
                </div>
              </div>
              )}
              <div data-tour="funds" className="flex items-center gap-2">
                <button
                  onClick={() => setShowAdd(true)}
                  className="border border-term-line px-2 py-1 text-[10px] uppercase tracking-wider text-term-fg hover:bg-black/5"
                >
                  Add money
                </button>
                <button
                  onClick={() => setShowWithdraw(true)}
                  className="border border-term-line px-2 py-1 text-[10px] uppercase tracking-wider text-term-dim hover:text-term-fg"
                >
                  Withdraw
                </button>
              </div>
              <button
                onClick={() => setShowTour(true)}
                title="Replay the product tour"
                aria-label="Replay the product tour"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-term-line text-[10px] text-term-dim hover:text-term-fg"
              >
                ?
              </button>
            </>
          )}
          <WalletButton />
        </div>
      </header>

      {/* Spotlight column */}
      <main className="mx-auto w-full max-w-6xl px-3 pt-8 sm:px-4 sm:pt-[8vh]">
        {/* Type bar — the spotlight. Deliberately large so it reads as the
            primary surface (not a search box). */}
        <div
          data-tour="search"
          className="flex items-center gap-3 border-b-2 border-term-mid pb-3 sm:gap-4 sm:pb-4"
        >
          <span className="text-3xl leading-none text-term-dim sm:text-5xl">
            /
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder={
              isLoading ? "loading markets…" : "type a ticker"
            }
            /* Visible blinking cursor (the brand's green caret) so it's obvious
               this line is a text field you can type into — both at rest
               (auto-focused) and while typing, where it follows the text. */
            className="w-full bg-transparent text-3xl text-term-fg caret-term-up placeholder:text-term-dim focus:outline-none sm:text-5xl"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="shrink-0 self-center text-[11px] uppercase tracking-wider text-term-dim hover:text-term-fg"
            >
              esc
            </button>
          )}
        </div>

        {/* Quick picks — seed the empty search with a tap. */}
        {!query && popular.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <span className="text-[10px] uppercase tracking-wider text-term-dim">
              Popular
            </span>
            {popular.map((m) => (
              <button
                key={m.coin}
                onClick={() => {
                  setQuery(m.name);
                  inputRef.current?.focus();
                }}
                className="border border-term-line px-2.5 py-1 text-[12px] tracking-wide text-term-mid transition-colors hover:border-term-mid hover:text-term-fg"
              >
                {m.name}
              </button>
            ))}
          </div>
        )}

        {/* Disconnected landing — value prop fills the void before a wallet is
            connected and no search is active. */}
        {!query && !address && (
          <div className="ml-rise mt-24 flex flex-col items-center px-4 text-center sm:mt-32">
            <p className="max-w-md text-[14px] font-medium leading-relaxed text-term-fg">
              A free open-source frontend for Hyperliquid. Minimal, fast,
              non-custodial.{" "}
              <span className="text-term-dim">//</span>
            </p>
            <p className="mt-2 text-[11px] text-term-dim">
              Connect a wallet, or sign up with an email, to start.
            </p>
          </div>
        )}

        {/* Results */}
        <div>
          {query && results.length === 0 && !isLoading && (
            <p className="px-3 py-6 text-center text-[11px] text-term-dim">
              no market matches “{query}”
            </p>
          )}
          {results.map((m, i) => (
            <TradeLine
              key={m.coin}
              market={m}
              selected={i === 0}
              index={i}
              onPlaced={handlePlaced}
            />
          ))}
        </div>

        {/* Account value + open positions — always side by side, responsive */}
        {address && (
          <div
            data-tour="account"
            className="mt-8 flex flex-row items-start gap-3 sm:gap-6"
          >
            <div className="w-[34%] shrink-0 sm:w-[28%]">
              <AccountChart />
            </div>
            <div className="min-w-0 flex-1">
              <Positions markets={markets} />
            </div>
          </div>
        )}

        {/* Account + positions side-by-side region gets the account tour anchor */}
      </main>

      <Disclaimer />
      {showAdd && <AddMoney onClose={() => setShowAdd(false)} />}
      {showWithdraw && <Withdraw onClose={() => setShowWithdraw(false)} />}
      {showTour && (
        <Tour steps={tourSteps} onClose={closeTour} />
      )}
    </div>
  );
}
