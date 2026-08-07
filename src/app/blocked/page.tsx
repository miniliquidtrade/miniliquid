import type { Metadata } from "next";
import { Brand } from "@/components/Brand";

export const metadata: Metadata = {
  title: "Not available in your region — miniliquid",
  robots: { index: false, follow: false },
};

export default function BlockedPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <Brand className="text-[15px]" />
      <h1 className="mt-6 font-mono text-xl font-semibold tracking-tight text-term-hi">
        Not available in your region
      </h1>
      <p className="mt-3 text-[13px] leading-relaxed text-term-mid">
        miniliquid isn&rsquo;t available to users in the United States or in
        restricted and sanctioned jurisdictions. Access from your location has
        been blocked.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-term-dim">
        This is an independent, non-custodial interface for a third-party
        protocol, not affiliated with Hyperliquid.
      </p>
    </main>
  );
}
