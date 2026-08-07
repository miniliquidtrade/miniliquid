import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy — miniliquid",
  description:
    "miniliquid is non-custodial and collects no personal information or accounts.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        miniliquid is non-custodial and collects <strong>no personal
        information</strong> and <strong>no accounts</strong>. It does not ask
        for your name, email, or identity.
      </p>
      <p>
        Your wallet address and transactions are public on the blockchain by
        nature. The Interface may load third-party services &mdash; wallet
        providers, blockchain RPC and market-data endpoints, and basic,
        privacy-respecting hosting analytics &mdash; that receive technical data
        such as your IP address and browser type in the ordinary course of
        serving the page; those are governed by their own privacy policies.
      </p>
      <p>
        We set no advertising or cross-site tracking cookies. Any preferences
        (such as dismissing the first-visit notice) are stored locally in your
        own browser and never sent to us.
      </p>
    </LegalPage>
  );
}
