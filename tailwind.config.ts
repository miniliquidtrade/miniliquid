import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
      },
      colors: {
        // Monochrome terminal palette — white background, layered grays.
        term: {
          bg: "#ffffff",
          panel: "#f5f5f5",
          line: "#e2e2e2",
          dim: "#9a9a9a",
          mid: "#6a6a6a",
          fg: "#1a1a1a",
          hi: "#000000",
          // The only colors in the app — reserved for live P&L.
          up: "#12894a",
          down: "#d1453b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
