// Privy configuration shared between the provider tree and the wallet hook.
//
// Privy gives wallet-less users an email / social login that provisions an
// embedded (self-custodial) wallet, so people without Rabby/MetaMask can still
// trade. It's OPT-IN via env: without NEXT_PUBLIC_PRIVY_APP_ID the app runs
// exactly as before (injected wallets only) and no Privy code path activates.

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/** True only when an app id is configured — gates every Privy hook/provider. */
export const PRIVY_ENABLED = PRIVY_APP_ID.length > 0;

/**
 * Who pays gas for the embedded-wallet deposit transaction.
 *  - default (false): the USER pays the few cents in their own USDC — no ETH,
 *    and you fund nothing. Requires "user pays gas in USDC" configured for
 *    Arbitrum in the Privy dashboard.
 *  - "true": the APP sponsors gas (billed through Privy's gas credits). Use
 *    this if Arbitrum doesn't offer a USDC gas-token option.
 * Either mode needs gas configured for Arbitrum in the Privy dashboard.
 */
export const PRIVY_APP_SPONSORS_GAS =
  process.env.NEXT_PUBLIC_PRIVY_APP_SPONSORS_GAS === "true";

/**
 * Optional preferred card on-ramp provider for the funding flow. Only
 * "coinbase" and "moonpay" are selectable here (must also be enabled in the
 * Privy dashboard). Leave unset to let Privy route. Coinbase Onramp tends to
 * have the smoothest Apple Pay guest checkout where available.
 */
const onrampProvider = process.env.NEXT_PUBLIC_PRIVY_ONRAMP_PROVIDER;
export const PRIVY_ONRAMP_PROVIDER: "coinbase" | "moonpay" | undefined =
  onrampProvider === "coinbase" || onrampProvider === "moonpay"
    ? onrampProvider
    : undefined;
