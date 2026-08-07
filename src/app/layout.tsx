import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "@/providers";
import { Footer } from "@/components/Footer";

// Prefer an explicit canonical URL; on Vercel fall back to the deployment URL
// so social-card images resolve to an absolute URL without manual config.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
const DESCRIPTION =
  "miniliquid — a fast, minimal, type-to-trade terminal for every market on Hyperliquid.";

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: "miniliquid",
  description: DESCRIPTION,
  applicationName: "miniliquid",
  openGraph: {
    title: "miniliquid",
    description: DESCRIPTION,
    siteName: "miniliquid",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "miniliquid",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistMono.variable} ${GeistSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Warm up the connections the app hits first, so the initial market
            data / login round-trip starts sooner. Both hosts are already in the
            CSP connect-src allowlist. */}
        <link
          rel="preconnect"
          href="https://api.hyperliquid.xyz"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://api.hyperliquid.xyz" />
        <link
          rel="preconnect"
          href="https://auth.privy.io"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-term-bg text-term-fg font-mono antialiased">
        <Providers>
          <div className="flex-1">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
