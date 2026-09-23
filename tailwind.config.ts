import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Antique gold / bronze. Replaces the earlier blue so every button,
        // link, pill, focus ring and highlight re-themes automatically —
        // nothing outside this file needs to change class names.
        brand: {
          50: "#fdf8ec", 100: "#faecc8", 200: "#f3d78c", 300: "#e9bd55",
          400: "#d9a13a", 500: "#bd8326", 600: "#96631b", 700: "#744c17",
          800: "#5c3d17", 900: "#4a3216",
        },
        // Near-black ink, for the navbar, hero and footer — the same dark,
        // sovereign surface thechetansharma.com uses (its theme colour is
        // exactly ink-950 below).
        ink: {
          700: "#1b1e3d", 800: "#12142c", 900: "#0b0d18", 950: "#05060c",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
