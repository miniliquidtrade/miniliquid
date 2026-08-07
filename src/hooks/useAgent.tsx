"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useWallet } from "@/hooks/useWallet";
import { approveAgent, type WalletClient } from "@/lib/hlExchange";
import { errMsg } from "@/lib/format";
import {
  loadAgentKey,
  saveAgentKey,
  clearAgentKey,
  newAgentKey,
  agentAddressFromKey,
  makeAgentSigner,
} from "@/lib/agentWallet";

interface AgentState {
  /** True when a local agent key exists for the connected wallet. */
  active: boolean;
  enabling: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => void;
  /**
   * The wallet client to use for L1 trading actions: the agent (silent, no
   * popup) when active, otherwise the master wallet (popup per action).
   */
  l1Signer: WalletClient | null;
  /**
   * Run an L1 action with the best signer, transparently falling back to the
   * master wallet if the agent is rejected by Hyperliquid ("does not exist").
   * onFallback fires when it drops the agent so the UI can inform the user.
   */
  runL1: <T>(
    fn: (signer: WalletClient) => Promise<T>,
    onFallback?: () => void
  ) => Promise<T>;
}

const Ctx = createContext<AgentState | null>(null);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const { address, walletClient } = useWallet();
  const [key, setKey] = useState<`0x${string}` | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load any stored agent key when the connected wallet changes.
  useEffect(() => {
    setKey(address ? loadAgentKey(address) : null);
    setError(null);
  }, [address]);

  const agentSigner = useMemo(() => (key ? makeAgentSigner(key) : null), [key]);

  // Create a fresh agent key and approve it on Hyperliquid with ONE master
  // signature. Crucially, approveAgent is a *user* action signed with the real
  // chainId (42161), which every wallet accepts — unlike L1 trade actions,
  // which use the phantom chainId 1337 that strict wallets (Rabby) refuse to
  // sign. Returns the ready-to-use agent signer.
  const ensureFreshAgent = useCallback(async (): Promise<WalletClient> => {
    if (!address || !walletClient) throw new Error("Connect a wallet first");
    const k = newAgentKey();
    const agentAddress = agentAddressFromKey(k);
    await approveAgent({ walletClient, agentAddress });
    saveAgentKey(address, k);
    setKey(k);
    return makeAgentSigner(k);
  }, [address, walletClient]);

  const enable = useCallback(async () => {
    if (!address || !walletClient) {
      setError("Connect a wallet first");
      return;
    }
    setEnabling(true);
    setError(null);
    try {
      await ensureFreshAgent();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setEnabling(false);
    }
  }, [address, walletClient, ensureFreshAgent]);

  const disable = useCallback(() => {
    if (address) clearAgentKey(address);
    setKey(null);
  }, [address]);

  const runL1 = useCallback(
    async <T,>(
      fn: (signer: WalletClient) => Promise<T>,
      onRepair?: () => void
    ): Promise<T> => {
      const master = walletClient;
      // Try the silent agent first when we have one.
      if (agentSigner) {
        try {
          return await fn(agentSigner);
        } catch (e) {
          const msg = errMsg(e);
          const agentBad = /does not exist|api wallet|agent/i.test(msg);
          if (agentBad && master) {
            // The agent was rejected by HL. Do NOT fall back to signing the
            // trade with the browser wallet: L1 actions use the phantom
            // chainId 1337, which strict wallets (Rabby) refuse to sign
            // ("chainId should be same as current chainId"). Instead re-approve
            // a fresh agent (a user action, signed with the real chainId that
            // every wallet accepts) and retry the trade with it.
            onRepair?.();
            const fresh = await ensureFreshAgent();
            return await fn(fresh);
          }
          throw e;
        }
      }
      // No agent yet (1-click off): approve one, then sign with it — again so
      // the browser wallet never has to sign a phantom-chainId L1 action.
      if (!master) throw new Error("Connect a wallet first");
      onRepair?.();
      const fresh = await ensureFreshAgent();
      return await fn(fresh);
    },
    [agentSigner, walletClient, ensureFreshAgent]
  );

  const value: AgentState = {
    active: !!key,
    enabling,
    error,
    enable,
    disable,
    l1Signer: agentSigner ?? walletClient,
    runL1,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}
