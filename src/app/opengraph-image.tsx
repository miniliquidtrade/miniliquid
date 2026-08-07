import { ImageResponse } from "next/og";

// Branded card shown when a Miniliquid link is unfurled (X, Telegram, iMessage…).
export const alt = "miniliquid — type-to-trade every market on Hyperliquid";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          padding: "80px",
          fontFamily: "monospace",
          color: "#ffffff",
        }}
      >
        {/* Brand lockup */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "20px" }}>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-6px" }}>
            mL
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 500 }}>
            <span>miniliquid</span>
            <span style={{ color: "#5c5c63" }}>//</span>
          </div>
        </div>

        {/* Value prop */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
            }}
          >
            <span>Type-to-trade every</span>
            <span>market on Hyperliquid.</span>
          </div>
          <div style={{ fontSize: 30, color: "#9a9aa2" }}>
            Perps on crypto, stocks, forex &amp; commodities. Minimal. Fast.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
