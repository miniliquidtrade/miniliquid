// Direct injected-wallet connection via EIP-6963 (multi-wallet discovery).
// No Privy / no embedded wallets — signatures always come from the real
// injected wallet the user selects, which is what HL recovers on-chain.

import type { WalletClient } from "./hlExchange";

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export interface DiscoveredWallet {
  rdns: string;
  name: string;
  icon: string;
  provider: Eip1193Provider;
}

const ARB_HEX = "0xa4b1"; // Arbitrum One (42161)

const ARB_PARAMS = {
  chainId: ARB_HEX,
  chainName: "Arbitrum One",
  rpcUrls: ["https://arb1.arbitrum.io/rpc"],
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  blockExplorerUrls: ["https://arbiscan.io"],
};

/** Collect every wallet that announces itself via EIP-6963. */
export function discoverWallets(timeoutMs = 250): Promise<DiscoveredWallet[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  const found = new Map<string, DiscoveredWallet>();

  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail as {
      info: { rdns: string; name: string; icon: string };
      provider: Eip1193Provider;
    };
    if (detail?.info?.rdns) {
      found.set(detail.info.rdns, {
        rdns: detail.info.rdns,
        name: detail.info.name,
        icon: detail.info.icon,
        provider: detail.provider,
      });
    }
  };

  window.addEventListener("eip6963:announceProvider", handler as EventListener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  return new Promise((resolve) => {
    setTimeout(() => {
      window.removeEventListener(
        "eip6963:announceProvider",
        handler as EventListener
      );
      // Fallback: bare window.ethereum if nothing announced via 6963.
      if (found.size === 0) {
        const eth = (window as unknown as { ethereum?: Eip1193Provider })
          .ethereum;
        if (eth) {
          found.set("injected", {
            rdns: "injected",
            name: "Injected Wallet",
            icon: "",
            provider: eth,
          });
        }
      }
      resolve(Array.from(found.values()));
    }, timeoutMs);
  });
}

export async function ensureArbitrum(provider: Eip1193Provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARB_HEX }],
    });
  } catch (err) {
    if ((err as { code?: number })?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [ARB_PARAMS],
      });
    }
    // Other errors (e.g. user rejection) bubble up to the caller.
  }
}

/**
 * Build the EIP712Domain type array from whichever domain fields are present.
 * Wallets require this to be declared explicitly for eth_signTypedData_v4;
 * omitting it lets the wallet guess, which can produce a signature Hyperliquid
 * recovers to the wrong address (agents registered under a bad master, etc.).
 */
function domainTypes(domain: Record<string, unknown>) {
  const t: { name: string; type: string }[] = [];
  if (domain.name !== undefined) t.push({ name: "name", type: "string" });
  if (domain.version !== undefined) t.push({ name: "version", type: "string" });
  if (domain.chainId !== undefined) t.push({ name: "chainId", type: "uint256" });
  if (domain.verifyingContract !== undefined)
    t.push({ name: "verifyingContract", type: "address" });
  return t;
}

/** Wrap a provider + address into the WalletClient the HL lib expects. */
export function makeWalletClient(
  address: string,
  provider: Eip1193Provider
): WalletClient {
  return {
    account: { address },
    signTypedData: async (args) => {
      const typedData = {
        domain: args.domain,
        primaryType: args.primaryType,
        message: args.message,
        types: {
          EIP712Domain: domainTypes(args.domain as Record<string, unknown>),
          ...(args.types as object),
        },
      };
      return (await provider.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(typedData)],
      })) as string;
    },
  };
}
