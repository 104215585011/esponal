import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#1f2933",
          red: "#c2413b",
          gold: "#f4b942",
          green: "#2f8f6f"
        }
      }
    }
  },
  plugins: []
};

export default config;
