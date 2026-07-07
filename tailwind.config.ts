import type { Config } from "tailwindcss";

/**
 * GuestSnap — "modern heirloom" theme.
 * Ivory canvas, ink text, terracotta accent, muted sage secondary.
 * Fraunces (display) + Inter (body). No purple gradients, no glassmorphism.
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        ink: "hsl(var(--ink))",
        ivory: "hsl(var(--ivory))",
        terracotta: "hsl(var(--primary))",
        sage: "hsl(var(--sage))",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,25,23,0.05), 0 2px 8px rgba(28,25,23,0.05)",
        lift: "0 2px 4px rgba(28,25,23,0.06), 0 8px 24px rgba(28,25,23,0.10)",
        card: "0 1px 1px rgba(28,25,23,0.04), 0 4px 16px rgba(28,25,23,0.06)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-settle": {
          "0%": { opacity: "0", transform: "scale(1.04)" },
          "60%": { opacity: "1", transform: "scale(0.99)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "develop": {
          from: { opacity: "0.2", filter: "contrast(0.6) brightness(1.3)" },
          to: { opacity: "1", filter: "contrast(1) brightness(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "scale-settle": "scale-settle 0.7s cubic-bezier(0.22,1,0.36,1) both",
        develop: "develop 1.2s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
