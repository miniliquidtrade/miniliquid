"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import {
  discoverWallets,
  ensureArbitrum,
  makeWalletClient,
  type DiscoveredWallet,
  type Eip1193Provider,
} from "@/lib/wallet";
import { PRIVY_ENABLED } from "@/lib/privy";
import type { WalletClient } from "@/lib/hlExchange";

// Privy SDK (~1.8MB) is code-split: this loads only when Privy is enabled,
// after first paint, and renders nothing itself — so it never blocks the app.
const PrivyMount = dynamic(() => import("@/hooks/PrivyMount"), { ssr: false });

const LAST_WALLET_KEY = "hlterm_last_wallet";

/** Where the currently-active signer comes from. */
type WalletSource = "injected" | "privy";

interface ActiveConn {
  source: WalletSource;
  address: string;
  provider: Eip1193Provider;
  /** Injected-wallet metadata (name/icon); null for Privy embedded wallets. */
  wallet: DiscoveredWallet | null;
}

interface WalletState {
  address: string | null;
  wallet: DiscoveredWallet | null;
  wallets: DiscoveredWallet[];
  connecting: boolean;
  error: string | null;
  /** Which kind of wallet is active (or null when disconnected). */
  source: WalletSource | null;
  connect: (rdns: string) => Promise<void>;
  /** Start Privy email / social login (opens the Privy modal). */
  loginWithPrivy: () => void;
  /** Whether the Privy path is configured at all. */
  privyEnabled: boolean;
  /** Whether Privy has finished initialising (safe to call loginWithPrivy). */
  privyReady: boolean;
  disconnect: () => void;
  refreshWallets: () => Promise<void>;
  walletClient: WalletClient | null;
  sendTransaction: (tx: {
    to: string;
    data?: string;
    value?: string;
  }) => Promise<string>;
  /** True for Privy embedded wallets, which support a fiat card on-ramp. */
  canFundWithCard: boolean;
  /**
   * Open Privy's on-ramp to buy USDC (on Arbitrum) into the embedded wallet.
   * Resolves when the funding flow closes. Only valid when canFundWithCard.
   */
  fundWithCard: (amountUsd: string) => Promise<void>;
  /** True for embedded wallets, which can export their private key. */
  canExportKey: boolean;
  /**
   * Open Privy's secure modal to reveal / copy the embedded wallet's private
   * key (loaded in an isolated iframe — our app never sees it).
   */
  exportKey: () => Promise<void>;
}

const Ctx = createContext<WalletState | null>(null);

/**
 * State the Privy bridge lifts up to the WalletProvider. The bridge resolves
 * the embedded wallet's EIP-1193 provider so the provider itself only ever
 * deals with plain values. Exported for the code-split PrivyMount module.
 */
export interface PrivyBridgeState {
  ready: boolean;
  authenticated: boolean;
  address: string | null;
  provider: Eip1193Provider | null;
  login: () => void;
  logout: () => Promise<void>;
  fund: (address: string, amountUsd: string) => Promise<void>;
  exportKey: (address: string) => Promise<void>;
  embeddedSend: (tx: {
    to: string;
    data?: string;
    value?: string;
  }) => Promise<string>;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [conn, setConn] = useState<ActiveConn | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privyReady, setPrivyReady] = useState(false);

  const connRef = useRef<ActiveConn | null>(null);
  connRef.current = conn;
  // Privy controls (login/logout) captured from the bridge.
  const privyRef = useRef<{
    login: () => void;
    logout: () => Promise<void>;
    authenticated: boolean;
    fund: (address: string, amountUsd: string) => Promise<void>;
    exportKey: (address: string) => Promise<void>;
    embeddedSend: (tx: {
      to: string;
      data?: string;
      value?: string;
    }) => Promise<string>;
  } | null>(null);

  const refreshWallets = useCallback(async () => {
    const found = await discoverWallets();
    setWallets(found);
  }, []);

  const attachListeners = useCallback((provider: Eip1193Provider) => {
    const onAccounts = (...args: unknown[]) => {
      const accts = args[0] as string[] | undefined;
      if (!accts || accts.length === 0) {
        // Only clear if the injected wallet is the active connection.
        setConn((prev) => (prev?.source === "injected" ? null : prev));
        localStorage.removeItem(LAST_WALLET_KEY);
      } else {
        setConn((prev) =>
          prev?.source === "injected" ? { ...prev, address: accts[0] } : prev
        );
      }
    };
    provider.on?.("accountsChanged", onAccounts);
  }, []);

  const connect = useCallback(
    async (rdns: string) => {
      setError(null);
      setConnecting(true);
      try {
        let list = wallets;
        if (list.length === 0) list = await discoverWallets();
        const target = list.find((w) => w.rdns === rdns) ?? list[0];
        if (!target) throw new Error("No wallet found. Install Rabby or MetaMask.");

        const accounts = (await target.provider.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (!accounts?.length) throw new Error("No accounts returned");

        await ensureArbitrum(target.provider);
        attachListeners(target.provider);

        localStorage.setItem(LAST_WALLET_KEY, target.rdns);
        // Injected wallets take priority over any Privy session.
        setConn({
          source: "injected",
          address: accounts[0],
          provider: target.provider,
          wallet: target,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setConnecting(false);
      }
    },
    [wallets, attachListeners]
  );

  const loginWithPrivy = useCallback(() => {
    setError(null);
    privyRef.current?.login();
  }, []);

  const disconnect = useCallback(() => {
    const cur = connRef.current;
    localStorage.removeItem(LAST_WALLET_KEY);
    setConn(null);
    // Tear down the Privy session too when it was the active wallet.
    if (cur?.source === "privy") {
      privyRef.current?.logout().catch(() => {
        /* ignore */
      });
    }
  }, []);

  // Discover injected wallets on mount, then silently reconnect the last-used
  // one if it's still authorized (eth_accounts does not prompt).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await discoverWallets();
      if (cancelled) return;
      setWallets(found);

      const last =
        typeof window !== "undefined"
          ? localStorage.getItem(LAST_WALLET_KEY)
          : null;
      if (!last) return;
      const target = found.find((w) => w.rdns === last);
      if (!target) return;
      try {
        const accounts = (await target.provider.request({
          method: "eth_accounts",
        })) as string[];
        if (!cancelled && accounts?.length) {
          attachListeners(target.provider);
          setConn((prev) =>
            // Don't clobber an already-active connection.
            prev
              ? prev
              : {
                  source: "injected",
                  address: accounts[0],
                  provider: target.provider,
                  wallet: target,
                }
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachListeners]);

  // Reconcile Privy state into the active connection.
  const handlePrivy = useCallback((s: PrivyBridgeState) => {
    setPrivyReady(s.ready);
    privyRef.current = {
      login: s.login,
      logout: s.logout,
      authenticated: s.authenticated,
      fund: s.fund,
      exportKey: s.exportKey,
      embeddedSend: s.embeddedSend,
    };
    setConn((prev) => {
      // An explicitly-connected injected wallet always wins.
      if (prev?.source === "injected") return prev;
      if (s.authenticated && s.address && s.provider) {
        if (prev?.source === "privy" && prev.address === s.address) return prev;
        return {
          source: "privy",
          address: s.address,
          provider: s.provider,
          wallet: null,
        };
      }
      // Logged out of Privy → drop a Privy connection.
      return prev?.source === "privy" ? null : prev;
    });
  }, []);

  const walletClient = useMemo<WalletClient | null>(() => {
    if (!conn) return null;
    return makeWalletClient(conn.address, conn.provider);
  }, [conn]);

  const fundWithCard = useCallback(async (amountUsd: string) => {
    const cur = connRef.current;
    if (cur?.source !== "privy" || !privyRef.current) {
      throw new Error(
        "Card funding is only available for email / social accounts."
      );
    }
    await privyRef.current.fund(cur.address, amountUsd);
  }, []);

  const exportKey = useCallback(async () => {
    const cur = connRef.current;
    if (cur?.source !== "privy" || !privyRef.current) {
      throw new Error(
        "Key export is only available for email / social accounts."
      );
    }
    await privyRef.current.exportKey(cur.address);
  }, []);

  const sendTransaction = useCallback(
    async (tx: { to: string; data?: string; value?: string }) => {
      const cur = connRef.current;
      if (!cur) throw new Error("Wallet not connected");
      // Privy embedded wallet: route through Privy so gas is paid per the
      // dashboard config (user's USDC by default) — a freshly-funded, zero-ETH
      // wallet can still transact.
      if (cur.source === "privy" && privyRef.current?.embeddedSend) {
        return privyRef.current.embeddedSend(tx);
      }
      // Injected wallet: ensure Arbitrum then send normally (it holds its own
      // gas). A send on the wrong network fails and some wallets surface a 500.
      await ensureArbitrum(cur.provider);
      return (await cur.provider.request({
        method: "eth_sendTransaction",
        params: [{ from: cur.address, ...tx }],
      })) as string;
    },
    []
  );

  const value: WalletState = {
    address: conn?.address ?? null,
    wallet: conn?.wallet ?? null,
    wallets,
    connecting,
    error,
    source: conn?.source ?? null,
    connect,
    loginWithPrivy,
    privyEnabled: PRIVY_ENABLED,
    privyReady,
    disconnect,
    refreshWallets,
    walletClient,
    sendTransaction,
    canFundWithCard: conn?.source === "privy",
    fundWithCard,
    canExportKey: conn?.source === "privy",
    exportKey,
  };

  return (
    <Ctx.Provider value={value}>
      {PRIVY_ENABLED && <PrivyMount onState={handlePrivy} />}
      {children}
    </Ctx.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
