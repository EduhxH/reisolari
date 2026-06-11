import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#020617",
        card: "#020617cc",
        accent: "#22c55e"
      }
    }
  },
  plugins: []
};
export default config;
