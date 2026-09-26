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
        canvas: "#F4F6FA",
        surface: "#FFFFFF",
        primary: {
          DEFAULT: "#4F46E5",
          hover: "#4338CA",
          light: "#EEF2FF",
        },
        navy: {
          900: "#0F172A",
          800: "#14213D",
          700: "#1E293B",
          DEFAULT: "#111827",
        },
        muted: "#667085",
        borderline: "#E6EAF0",
        kpi: {
          indigo: "#4F46E5",
          emerald: "#059669",
          sky: "#0284C7",
          violet: "#7C3AED",
          rose: "#E11D48",
          amber: "#D97706",
        },
      },
      boxShadow: {
        card: "0 12px 30px rgba(16, 24, 40, 0.06)",
        cardHover: "0 18px 36px rgba(16, 24, 40, 0.10)",
      },
      borderRadius: {
        card: "18px",
      },
    },
  },
  plugins: [],
};
export default config;
