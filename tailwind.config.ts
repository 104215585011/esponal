import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          ink: "#1f2933",
          red: "#c2413b",
          gold: "#f4b942"
        },
        app: "#F9FAFB",
        surface: "#FFFFFF",
        muted: "#F3F4F6"
      },
      borderRadius: {
        card: "12px",
        surface: "16px",
        hero: "24px"
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)",
        elevated: "0 4px 12px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.08)",
        hero: "0 4px 6px -1px rgba(0,0,0,0.07), 0 24px 60px -8px rgba(0,0,0,0.12)"
      }
    }
  },
  plugins: []
};

export default config;
