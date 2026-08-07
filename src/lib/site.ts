// Canonical, single-source-of-truth links used across the footer, legal
// pages and the disclaimer. Keep the domain in sync with the launch runbook
// (docs/LAUNCH.md) — one canonical URL everywhere.

export const SITE = {
  name: "miniliquid",
  url: "https://miniliquid.trade",
  /** Public X profile — update the handle here if it ever changes. */
  x: "https://x.com/miniliquidtrade",
  xHandle: "@miniliquidtrade",
  /** Open-source repository (the project is MIT-licensed and public). */
  github: "https://github.com/miniliquidtrade/miniliquid",
  /** When the legal docs were last revised — shown on each legal page. */
  legalUpdated: "7 August 2026",
} as const;
