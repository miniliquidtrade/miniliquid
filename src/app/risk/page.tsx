import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Risk Disclosure — miniliquid",
  description:
    "The risks of trading perpetual futures on Hyperliquid through miniliquid.",
};

export default function RiskPage() {
  return (
    <LegalPage title="Risk Disclosure">
      <p>
        Trading perpetual futures on Hyperliquid through miniliquid carries a
        high level of risk and is not suitable for everyone. Before using it,
        make sure you understand the following.
      </p>

      <ul>
        <li>
          <strong>You can lose everything.</strong> Leveraged perpetuals can be
          liquidated within seconds; you may lose your entire margin, and in some
          conditions more.
        </li>
        <li>
          <strong>Estimates are not guarantees.</strong> Liquidation prices,
          profit-and-loss figures, and market data shown are estimates and may
          be delayed or wrong. Never trade on the assumption that they are exact.
        </li>
        <li>
          <strong>The software is experimental.</strong> miniliquid is free,
          open-source, non-custodial software provided with no warranty. Bugs,
          downtime, and unexpected behavior are possible.
        </li>
        <li>
          <strong>The protocol is third-party.</strong> Trades execute on
          Hyperliquid, which miniliquid does not operate or control.
          Smart-contract, oracle, and protocol risks are yours.
        </li>
        <li>
          <strong>You are self-custodial.</strong> Your keys and funds are yours
          alone. No one &mdash; including miniliquid &mdash; can recover lost
          keys or reverse a transaction.
        </li>
        <li>
          <strong>Regulation varies.</strong> Derivatives trading is restricted
          or illegal in some places, including for U.S. persons. You are
          responsible for knowing and following the laws where you live.
        </li>
      </ul>

      <p>
        <strong>
          Only trade with funds you can afford to lose entirely. If you do not
          fully understand these risks, do not trade.
        </strong>
      </p>
    </LegalPage>
  );
}
