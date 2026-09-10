/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./overlay.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        syn: {
          bg: "#09090b",
          sidebar: "#0c0c0e",
          panel: "#111113",
          card: "#141416",
          elevated: "#18181b",
          border: "#222226",
          line: "#1c1c1f",
          muted: "#73737a",
          dim: "#52525b",
          text: "#f4f4f5",
          sub: "#a1a1aa",
          green: "#22c55e",
          greenDim: "#16a34a",
          red: "#f02d5e",
          purple: "#8b5cf6",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        ethnocentric: ["Ethnocentric", "Mokoto", "sans-serif"],
        mokoto: ["Mokoto", "Ethnocentric", "sans-serif"],
      },
      fontSize: {
        "2xs": ["10px", "14px"],
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};
