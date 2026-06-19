import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        inter: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter Display", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Instrument Serif", "Georgia", "serif"],
        mono: ["Fragment Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      colors: {
        bg: "#020617",
        card: "#020617cc",
        accent: "#22c55e",
        supaste: {
          paper: "#ffffff",
          // Page background — a soft, slightly cool light so white cards stand out.
          mist: "#e8ecf2",
          // Inset surfaces (pills, fields) on white cards.
          section: "#eef1f6",
          ink: "#1d1d1f",
          muted: "#7c7f87",
          black: "#0d0d0d",
          blue: "#006fff",
          iris: "#5f61ed",
          green: "#1f9d57"
        }
      },
      boxShadow: {
        glass:
          "inset 0 2px 4px #ffffff33, inset 0 4px 8px #ffffff40, inset 0 -20px 20px #ffffff40, inset 0 -1px #ffffff66",
        "supaste-frame": "0 40px 120px rgba(0, 0, 0, 0.16)",
        "soft-float": "0 24px 70px rgba(13, 13, 13, 0.13)"
      }
    }
  },
  plugins: []
};
export default config;
