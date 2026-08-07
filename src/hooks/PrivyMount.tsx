"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  PrivyProvider,
  usePrivy,
  useWallets,
  useFundWallet,
  useSendTransaction,
  getEmbeddedConnectedWallet,
} from "@privy-io/react-auth";
import { arbitrum } from "viem/chains";
import {
  PRIVY_APP_ID,
  PRIVY_APP_SPONSORS_GAS,
  PRIVY_ONRAMP_PROVIDER,
} from "@/lib/privy";
import type { Eip1193Provider } from "@/lib/wallet";
import type { PrivyBridgeState } from "@/hooks/useWallet";

/**
 * Everything that touches `@privy-io/react-auth` lives here so it can be
 * code-split. This module is loaded via next/dynamic (ssr:false) only when
 * Privy is enabled, keeping ~1.8MB of Privy SDK out of the initial bundle and
 * off the critical path. It renders no app UI — it wraps only its own bridge —
 * so lazy-loading it never blocks first paint.
 */

// Lives inside <PrivyProvider>: watches Privy auth + the embedded wallet,
// resolves its EIP-1193 provider, and reports everything up via onState.
function Bridge({ onState }: { onState: (s: PrivyBridgeState) => void }) {
  const { ready, authenticated, login, logout, exportWallet } = usePrivy();
  const { wallets } = useWallets();
  const { fundWallet } = useFundWallet();
  const { sendTransaction: privySend } = useSendTransaction();
  const embedded = getEmbeddedConnectedWallet(wallets);
  const address = embedded?.address ?? null;

  // Send from the embedded wallet via Privy so gas is handled by Privy's
  // native gas config (EIP-7702) — no ETH in the wallet required. By default
  // the user pays the few cents in their own USDC; set PRIVY_APP_SPONSORS_GAS
  // to have the app sponsor it instead.
  const embeddedSend = useCallback(
    async (tx: { to: string; data?: string; value?: string }) => {
      const res = await privySend(
        {
          to: tx.to,
          data: tx.data,
          value: tx.value,
          chainId: arbitrum.id,
        },
        PRIVY_APP_SPONSORS_GAS ? { sponsor: true } : undefined
      );
      return res.hash as string;
    },
    [privySend]
  );

  // Fiat on-ramp: buy USDC on Arbitrum straight into the embedded wallet.
  const fund = useCallback(
    (addr: string, amountUsd: string) =>
      fundWallet(addr, {
        chain: arbitrum,
        asset: "USDC",
        amount: amountUsd,
        defaultFundingMethod: "card",
        ...(PRIVY_ONRAMP_PROVIDER
          ? { card: { preferredProvider: PRIVY_ONRAMP_PROVIDER } }
          : {}),
      }),
    [fundWallet]
  );

  const exportKey = useCallback(
    (addr: string) => exportWallet({ address: addr }),
    [exportWallet]
  );

  // Cache the resolved provider so we only fetch it once per embedded address.
  const providerRef = useRef<Eip1193Provider | null>(null);
  const resolvedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (address && embedded && resolvedFor.current !== address) {
        try {
          const provider =
            (await embedded.getEthereumProvider()) as unknown as Eip1193Provider;
          if (cancelled) return;
          providerRef.current = provider;
          resolvedFor.current = address;
        } catch {
          /* leave provider null; user can retry */
        }
      }
      if (!address) {
        providerRef.current = null;
        resolvedFor.current = null;
      }
      if (!cancelled) {
        onState({
          ready,
          authenticated,
          address,
          provider: providerRef.current,
          login,
          logout,
          fund,
          exportKey,
          embeddedSend,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `embedded` is intentionally omitted — `address` keys its identity and
    // avoids re-firing on every Privy poll that returns a fresh array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    authenticated,
    address,
    login,
    logout,
    fund,
    exportKey,
    embeddedSend,
    onState,
  ]);

  return null;
}

// Default export so next/dynamic can load it. Wraps the bridge in its own
// PrivyProvider — it wraps nothing else, so the app renders without waiting.
export default function PrivyMount({
  onState,
}: {
  onState: (s: PrivyBridgeState) => void;
}) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Wallet-less sign-in. External wallets use our own EIP-6963 flow, so
        // we intentionally leave "wallet" out of Privy's methods.
        loginMethods: ["email", "google"],
        embeddedWallets: { createOnLogin: "users-without-wallets" },
        defaultChain: arbitrum,
        supportedChains: [arbitrum],
        appearance: { theme: "light", accentColor: "#000000" },
      }}
    >
      <Bridge onState={onState} />
    </PrivyProvider>
  );
}
