import { NextResponse, type NextRequest } from "next/server";

// Restricted jurisdictions: the United States (CFTC exposure for retail
// perps) plus the comprehensively sanctioned countries. Region-level areas
// (Crimea, Donetsk, Luhansk) can't be resolved from a country code; the Terms
// and the first-visit acknowledgment cover that residual. VPN users can evade
// any geoblock — this is a good-faith edge filter, not a guarantee.
const BLOCKED = new Set(["US", "CU", "IR", "KP", "SY"]);

export function middleware(req: NextRequest) {
  // Vercel populates `geo.country` at the edge (ISO-3166-1 alpha-2). It's
  // undefined in local dev, so we fail open there and only block on real geo.
  const country = req.geo?.country;
  if (country && BLOCKED.has(country)) {
    const url = req.nextUrl.clone();
    url.pathname = "/blocked";
    // Rewrite (not redirect) so the URL is unchanged and the branded notice is
    // served in place; 451 = Unavailable For Legal Reasons.
    return NextResponse.rewrite(url, { status: 451 });
  }
  return NextResponse.next();
}

export const config = {
  // Run on page routes only — skip Next internals, static assets, the OG
  // image, and the /blocked notice itself (so it can always render).
  matcher: [
    "/((?!_next/static|_next/image|blocked|favicon.ico|icon.svg|opengraph-image|robots.txt|sitemap.xml).*)",
  ],
};
