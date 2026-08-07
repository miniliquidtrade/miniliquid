# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

Use GitHub's private vulnerability reporting: go to the **Security** tab →
**Report a vulnerability** (enable it under *Settings → Code security → Private
vulnerability reporting* if it isn't already). We aim to acknowledge reports
within a few days.

## What matters here

miniliquid is a **non-custodial static frontend**. It holds no user funds and
runs no backend that stores keys or proxies trades:

- Signing happens **client-side** (injected wallets, or a Privy embedded wallet).
- Orders go **browser → Hyperliquid** directly.

So the highest-value targets are the **deploy pipeline** and the **domain**, not
a server holding money. Reports we especially want:

- Anything that could ship malicious code to production (CI/deploy, dependency,
  or supply-chain issues).
- Ways to exfiltrate a session/agent key or trick a user into signing something
  they didn't intend (XSS, CSP bypass, clickjacking, look-alike/phishing vectors).
- Weaknesses in the domain / DNS / TLS configuration.

## Out of scope

- Vulnerabilities in Hyperliquid, Privy, or wallet extensions themselves —
  report those to the respective projects.
- Missing security headers that don't lead to a concrete exploit.
- Automated scanner output without a demonstrated impact.

Thanks for helping keep miniliquid users safe.
