import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service — miniliquid",
  description:
    "Terms of Service for miniliquid, a free, open-source, non-custodial interface for the Hyperliquid protocol.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        <strong>
          Please read these Terms carefully. By accessing or using
          miniliquid.trade (the &ldquo;Interface&rdquo;), you agree to them. If
          you do not agree, do not use the Interface.
        </strong>
      </p>

      <h2>1. What the Interface is</h2>
      <p>
        miniliquid (the &ldquo;Interface&rdquo;) is a free, open-source,{" "}
        <strong>non-custodial</strong> web interface that helps you interact
        with the <strong>Hyperliquid</strong> protocol (the
        &ldquo;Protocol&rdquo;), a third-party decentralized system that the
        operator of the Interface does not own, control, or operate. The
        Interface is a tool for constructing and relaying transactions that{" "}
        <strong>you</strong> sign with <strong>your own</strong> self-custodial
        wallet. It is not a broker, dealer, exchange, marketplace, custodian,
        wallet provider, or financial intermediary.
      </p>

      <h2>2. No custody</h2>
      <p>
        The Interface never takes possession or control of your funds, assets,
        or private keys. You retain sole custody and control at all times. You
        alone are responsible for securing your wallet, keys, and credentials.
        Transactions are executed by the Protocol and the blockchain, not by the
        Interface; they are irreversible and the Interface cannot cancel,
        reverse, or recover them.
      </p>

      <h2>3. No fees</h2>
      <p>
        The Interface charges you no fees. Network (&ldquo;gas&rdquo;) costs and
        any fees charged by the Protocol itself are separate and outside the
        operator&rsquo;s control.
      </p>

      <h2>4. Not affiliated with Hyperliquid</h2>
      <p>
        The Interface is independent and is <strong>not</strong> affiliated
        with, endorsed by, sponsored by, or operated by Hyperliquid, Hyper
        Foundation, HL Labs, or any of their affiliates. The operator does not
        control the Protocol and is not responsible for its performance,
        availability, security, or any losses arising from it.
      </p>

      <h2>5. Eligibility and restricted jurisdictions</h2>
      <p>You represent and warrant that:</p>
      <ul>
        <li>
          you are of legal age and have full capacity to accept these Terms;
        </li>
        <li>
          you are <strong>not</strong> a resident, citizen, national, or agent
          of, and are not located in, any jurisdiction where use of the
          Interface or trading of perpetual futures or other derivatives is
          prohibited or restricted, including without limitation the{" "}
          <strong>United States of America</strong> and any jurisdiction subject
          to comprehensive sanctions (including Cuba, Iran, North Korea, Syria,
          and the Crimea, Donetsk, and Luhansk regions);
        </li>
        <li>
          you are <strong>not</strong> a person listed on any sanctions or
          restricted-parties list (including the U.S. OFAC list of Specially
          Designated Nationals); and
        </li>
        <li>
          you will not use the Interface on behalf of any such person or from
          any such jurisdiction, including by using a VPN or other means of
          concealing your location.
        </li>
      </ul>
      <p>
        The operator may restrict access from any jurisdiction at its
        discretion.
      </p>

      <h2>6. No financial advice or solicitation</h2>
      <p>
        The Interface, and all content in it, is provided for informational and
        convenience purposes only. Nothing in it is, or should be construed as,
        financial, investment, legal, tax, or other advice, or a recommendation,
        solicitation, or offer to buy or sell any asset or to engage in any
        transaction or strategy. You are solely responsible for your own
        decisions. Any data, prices, charts, estimated liquidation prices, or
        profit-and-loss figures shown are estimates, may be inaccurate or
        delayed, and must not be relied upon.
      </p>

      <h2>7. Assumption of risk</h2>
      <p>
        Trading perpetual futures and other crypto-asset derivatives is{" "}
        <strong>extremely risky</strong> and can result in the{" "}
        <strong>total loss</strong> of your funds, including losses exceeding
        your initial margin. Leverage magnifies both gains and losses and can
        cause rapid liquidation. You further accept the risks of price
        volatility; smart-contract, protocol, and oracle failures; network
        congestion or downtime; hacks and exploits; regulatory changes; and the
        experimental nature of this open-source software.{" "}
        <strong>
          You use the Interface entirely at your own risk and are solely
          responsible for any resulting losses.
        </strong>{" "}
        See our <Link href="/risk">Risk Disclosure</Link>.
      </p>

      <h2>8. Your compliance responsibility</h2>
      <p>
        You are solely responsible for complying with all laws, rules, and
        regulations that apply to you, including securities, derivatives, tax,
        and anti-money-laundering laws, and for reporting and paying any taxes on
        your activity.
      </p>

      <h2>9. Open-source software; &ldquo;AS IS&rdquo;</h2>
      <p>
        The Interface is open-source software provided under the MIT license in
        the project{" "}
        <a href={SITE.github} target="_blank" rel="noreferrer noopener">
          repository
        </a>
        . THE INTERFACE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
        AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
        INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
        NON-INFRINGEMENT. The operator does not warrant that the Interface will
        be uninterrupted, secure, accurate, or error-free.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR AND CONTRIBUTORS
        WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
        EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, ASSETS, OR DATA,
        ARISING FROM OR RELATED TO YOUR USE OF (OR INABILITY TO USE) THE
        INTERFACE OR THE PROTOCOL, WHETHER BASED ON WARRANTY, CONTRACT, TORT, OR
        ANY OTHER THEORY, EVEN IF ADVISED OF THE POSSIBILITY. Because the
        Interface is free and non-custodial, the operator&rsquo;s total
        aggregate liability will not exceed <strong>US $100</strong>. Some
        jurisdictions do not allow certain limitations, so parts of this section
        may not apply to you.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless the operator and contributors
        from any claim, demand, loss, or expense (including reasonable legal
        fees) arising from your use of the Interface, your violation of these
        Terms, or your violation of any law or third-party right.
      </p>

      <h2>12. Third-party services</h2>
      <p>
        The Interface may connect to third-party services (for example, wallet
        providers, RPC and market-data endpoints, and the Protocol). The
        operator does not control and is not responsible for them; your use of
        them is governed by their own terms.
      </p>

      <h2>13. Changes and availability</h2>
      <p>
        The operator may modify, suspend, or discontinue the Interface, or update
        these Terms, at any time without notice. Continued use after changes
        means you accept the updated Terms.
      </p>

      <h2>14. Governing law</h2>
      <p>
        These Terms are governed by the laws of the country in which the
        operator is resident, without regard to conflict-of-laws rules, and any
        disputes will be subject to the exclusive jurisdiction of the courts of
        that country. Nothing in this section removes any mandatory consumer
        protection you may have under the laws of your own country of residence.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions or issues: open an issue on{" "}
        <a href={SITE.github} target="_blank" rel="noreferrer noopener">
          GitHub
        </a>{" "}
        or reach out on X at{" "}
        <a href={SITE.x} target="_blank" rel="noreferrer noopener">
          {SITE.xHandle}
        </a>
        .
      </p>
    </LegalPage>
  );
}
