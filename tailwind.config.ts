import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F8FAFC",
        surface: "#FFFFFF",
        // Brand teal. Components still say "indigo-*"; remapping here rebrands them all.
        indigo: {
          50: "#F0F9FA",
          100: "#D9EFF2",
          200: "#B5DEE4",
          300: "#84C5CF",
          400: "#4BA3B2",
          500: "#23808F",
          600: "#136573",
          700: "#0F4C5C",
          800: "#0C3C49",
          900: "#0A2F3A",
        },
        primary: {
          DEFAULT: "#136573",
          hover: "#0F4C5C",
          light: "#F0F9FA",
        },
        navy: {
          900: "#071720",
          800: "#0B1F2A",
          700: "#12303F",
          DEFAULT: "#0F172A",
        },
        muted: "#64748B",
        borderline: "#E2E8F0",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04)",
        cardHover: "0 2px 8px rgba(15, 23, 42, 0.08)",
      },
      borderRadius: {
        xl: "8px",
        "2xl": "10px",
        card: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
