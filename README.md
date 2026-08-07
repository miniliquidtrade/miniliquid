# miniliquid

A free, open-source, non-custodial frontend for [Hyperliquid](https://hyperliquid.xyz).
Minimal and fast — type a ticker, set leverage, go long or short.

> **Independent & unofficial.** miniliquid is not affiliated with, endorsed by,
> or operated by Hyperliquid. It is non-custodial: it never holds your keys or
> funds, and it charges **no fees**. Trading perpetual futures is risky and can
> lose you everything — see the in-app Terms and Risk Disclosure.

## What it is

- **Non-custodial.** Signing happens in your browser (an injected wallet, or a
  Privy embedded wallet). Orders go browser → Hyperliquid directly. There is no
  backend holding keys or funds.
- **No fees.** Orders are sent straight to the exchange.
- **Type-to-trade.** Every market on Hyperliquid — crypto, stocks, forex,
  commodities — from one search bar.

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS · viem · Privy · TanStack Query.
It's a static frontend that talks to the public Hyperliquid API.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

The only required value is a [Privy](https://privy.io) app ID for wallet
login. See `.env.example` for the full list of supported variables (all are
client-side `NEXT_PUBLIC_*` configuration).

```bash
npm run build   # production build
npm run lint    # lint
```

## Contributing

Contributions are welcome. Fork the repo, create a branch, and open a pull
request describing your change. Please keep the minimal, monochrome aesthetic
and run `npm run build` before opening a PR.

## Security

Please report vulnerabilities privately — see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE). You're free to use, modify, and redistribute the code,
including commercially, as long as you keep the copyright and license notice.
The name "miniliquid", the logo, and the miniliquid.trade website are not
covered by the license.
