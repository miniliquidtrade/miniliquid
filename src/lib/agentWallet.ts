// Hyperliquid agent (API) wallet.
//
// A locally-generated keypair, approved once by the master wallet, that can
// sign L1 trading actions (orders, cancels, leverage, TP/SL) WITHOUT a wallet
// popup. Agents are restricted by Hyperliquid to trading only — they can never
// withdraw or transfer funds — so keeping the key in localStorage trades a
// modest risk (someone with the key could place trades, never drain funds) for
// a popup-free experience.

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { WalletClient } from "./hlExchange";

const keyFor = (master: string) => `hlterm_agent_${master.toLowerCase()}`;

export function loadAgentKey(master: string): `0x${string}` | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(keyFor(master));
  return v && v.startsWith("0x") ? (v as `0x${string}`) : null;
}

export function saveAgentKey(master: string, key: string) {
  if (typeof window !== "undefined") localStorage.setItem(keyFor(master), key);
}

export function clearAgentKey(master: string) {
  if (typeof window !== "undefined") localStorage.removeItem(keyFor(master));
}

export function newAgentKey(): `0x${string}` {
  return generatePrivateKey();
}

export function agentAddressFromKey(key: `0x${string}`): string {
  return privateKeyToAccount(key).address;
}

/** Wrap an agent private key as the WalletClient the HL lib expects. */
export function makeAgentSigner(key: `0x${string}`): WalletClient {
  const account = privateKeyToAccount(key);
  // viem's signTypedData has strict generics; the HL lib passes a plain,
  // already-correct typed-data object, so bridge it through a loose signature.
  const signTypedData = account.signTypedData as unknown as (a: {
    domain: object;
    types: object;
    primaryType: string;
    message: object;
  }) => Promise<string>;
  return {
    account: { address: account.address },
    signTypedData: (args) => signTypedData(args),
  };
}
