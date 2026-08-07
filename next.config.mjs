/** @type {import('next').NextConfig} */

// Content-Security-Policy. Kept deliberately compatible with injected wallet
// extensions (which add inline provider scripts) and the two backends we call,
// while locking down the things that matter for a money app:
//  - frame-ancestors 'none'  → can't be iframed → no clickjacking of signatures
//  - object-src 'none', base-uri 'self' → no plugin / <base> hijack
//  - connect-src allowlist   → even under XSS, data can't be exfiltrated to a
//    third-party host (the agent trading key can't be POSTed to an attacker)
//
// Privy (email / social login → embedded wallet) needs its own hosts allowed:
//  - connect-src: auth.privy.io + *.privy.io (API/analytics), wss for its
//    socket, *.rpc.privy.systems for the embedded wallet's RPC
//  - frame-src:   auth.privy.io (embedded-wallet iframe) + Cloudflare Turnstile
//    (bot check on email login)
//  - script-src:  challenges.cloudflare.com (Turnstile widget)
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // On-ramp quote calls (MoonPay + Stripe). The provider checkout itself opens
  // in a popup window (not an iframe), so no frame-src entry is needed. If you
  // enable another on-ramp later and its quote step errors, add its API host.
  "connect-src 'self' https://api.hyperliquid.xyz https://arb1.arbitrum.io https://auth.privy.io https://*.privy.io wss://*.privy.io https://*.rpc.privy.systems https://api.moonpay.com https://api.stripe.com https://*.stripe.com",
  "frame-src 'self' https://auth.privy.io https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob: https://auth.privy.io",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
