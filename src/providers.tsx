"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WalletProvider } from "@/hooks/useWallet";
import { AgentProvider } from "@/hooks/useAgent";
import { ToastProvider } from "@/hooks/useToast";

/**
 * Privy is no longer wrapped around the whole app here — the WalletProvider
 * mounts it lazily (code-split) only when configured, so ~1.8MB of Privy SDK
 * stays off the initial critical path.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <WalletProvider>
        <AgentProvider>
          <ToastProvider>{children}</ToastProvider>
        </AgentProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
