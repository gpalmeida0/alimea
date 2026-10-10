import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Alimea brand palette
        brand: {
          DEFAULT: "#2E7D32",
          50: "#EEF6EE",
          100: "#D7EBD8",
          200: "#B3D9B5",
          500: "#2E7D32",
          600: "#256628",
          700: "#1D521F",
        },
        // Warm neutrals borrowed from the PDF template (cream / taupe).
        cream: "#F4F1EE",
        taupe: "#B49D8A",
        background: "#F7F8F5",
        foreground: "#1F2A24",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "#2E7D32",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#66BB6A",
          foreground: "#0F2911",
        },
        accent: {
          DEFAULT: "#E07B00",
          foreground: "#FFFFFF",
          700: "#9A5400",
        },
        muted: {
          DEFAULT: "#EFF2EC",
          foreground: "#5C6862",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#FFFFFF",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
