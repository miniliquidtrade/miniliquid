import Link from "next/link";
import { SITE } from "@/lib/site";

/**
 * Global footer: the standing "open-source / not affiliated / non-custodial"
 * disclaimer plus links to the legal pages (Terms / Risk / Privacy) and the
 * project's public homes. Rendered on every route from the root layout. The
 * risk and jurisdiction language lives on the linked pages, not here.
 * Deliberately quiet —
 * term-dim text, a single hairline rule — so it never competes with the app.
 */
export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-2xl px-4 py-8 text-[10px] leading-relaxed text-term-dim">
      <div className="border-t border-term-line pt-4">
        <p>
          <span className="text-term-mid">miniliquid</span> is a free,
          open-source frontend for Hyperliquid. Minimal, fast, non-custodial.
          Not affiliated with Hyperliquid.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 uppercase tracking-wider">
          <Link href="/terms" className="hover:text-term-fg">
            Terms
          </Link>
          <Link href="/risk" className="hover:text-term-fg">
            Risk
          </Link>
          <Link href="/privacy" className="hover:text-term-fg">
            Privacy
          </Link>
          <a
            href={SITE.github}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-term-fg"
          >
            GitHub
          </a>
          <a
            href={SITE.x}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-term-fg"
          >
            X
          </a>
          <span className="ml-auto normal-case tracking-normal text-term-line">
            miniliquid.trade
          </span>
        </div>
      </div>
    </footer>
  );
}
