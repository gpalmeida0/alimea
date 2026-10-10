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
      // Every colour is a CSS variable (defaults in globals.css) so each account
      // can restyle its workspace — see src/lib/theme.ts.
      colors: {
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
        },
        // Warm neutrals borrowed from the PDF template (cream / taupe).
        cream: "rgb(var(--cream) / <alpha-value>)",
        taupe: "rgb(var(--taupe) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--brand) / <alpha-value>)",
        card: { DEFAULT: "rgb(var(--card) / <alpha-value>)", foreground: "rgb(var(--card-foreground) / <alpha-value>)" },
        primary: { DEFAULT: "rgb(var(--brand) / <alpha-value>)", foreground: "rgb(var(--brand-foreground) / <alpha-value>)" },
        secondary: { DEFAULT: "rgb(var(--secondary) / <alpha-value>)", foreground: "rgb(var(--secondary-foreground) / <alpha-value>)" },
        accent: { DEFAULT: "rgb(var(--accent) / <alpha-value>)", foreground: "rgb(var(--accent-foreground) / <alpha-value>)", 700: "rgb(var(--accent-700) / <alpha-value>)" },
        muted: { DEFAULT: "rgb(var(--muted) / <alpha-value>)", foreground: "rgb(var(--muted-foreground) / <alpha-value>)" },
        destructive: { DEFAULT: "rgb(var(--destructive) / <alpha-value>)", foreground: "rgb(var(--destructive-foreground) / <alpha-value>)" },
      },
      // Scaled by the account's corner style (sharp / soft / round).
      borderRadius: {
        sm: "calc(0.375rem * var(--radius-scale))",
        DEFAULT: "calc(0.25rem * var(--radius-scale))",
        md: "calc(0.5rem * var(--radius-scale))",
        lg: "calc(0.75rem * var(--radius-scale))",
        xl: "calc(0.75rem * var(--radius-scale))",
        "2xl": "calc(1rem * var(--radius-scale))",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        logo: ["var(--font-logo)", "var(--font-sans)", "sans-serif"],
        serif: ["var(--font-heading, var(--font-serif))", "Georgia", "serif"],
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
