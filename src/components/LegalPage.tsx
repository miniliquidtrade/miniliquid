import Link from "next/link";
import { Brand } from "@/components/Brand";
import { SITE } from "@/lib/site";

/**
 * Shared chrome for the /terms, /risk and /privacy pages: the wordmark (links
 * home), a back link, the title with a "last updated" stamp, and a content
 * area that styles plain <h2>/<p>/<ul> so each page is just prose. Sans-serif
 * body for readability; the terminal palette and mono headings keep the brand.
 */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="Back to miniliquid">
          <Brand className="text-[13px]" />
        </Link>
        <Link
          href="/"
          className="text-[10px] uppercase tracking-wider text-term-dim hover:text-term-fg"
        >
          ← back
        </Link>
      </div>

      <h1 className="mt-10 font-mono text-2xl font-semibold tracking-tight text-term-hi">
        {title}
      </h1>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-term-dim">
        Last updated: {SITE.legalUpdated}
      </p>

      <div
        className="mt-8 space-y-4 font-sans text-[13px] leading-relaxed text-term-mid [&_a]:text-term-fg [&_a]:underline [&_h2]:mb-1 [&_h2]:mt-8 [&_h2]:font-mono [&_h2]:text-[12px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:text-term-fg [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-term-fg [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
      >
        {children}
      </div>
    </main>
  );
}
