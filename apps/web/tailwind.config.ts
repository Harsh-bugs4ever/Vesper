import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui-kit/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Luxury Resort Brand Tokens
        sage: {
          50: "#f3f7f4",
          100: "#e3ece6",
          200: "#c8dad0",
          300: "#a3c0af",
          400: "#79a18a",
          500: "#5a846c",
          600: "#446954", // primary brand sage
          700: "#375443",
          800: "#2d4437",
          900: "#26392f",
          950: "#14201a",
        },
        sand: {
          50: "#faf8f5", // warm resort ivory canvas
          100: "#f4efe6", // soft card/surface tint
          200: "#e8ded0", // warm border
          300: "#d7c5ae",
          400: "#c2a88b",
          500: "#ad8e6d",
          600: "#987556",
          700: "#7d5d44",
          800: "#674d3b",
          900: "#554032",
        },
        gold: {
          50: "#faf7ec",
          100: "#f3ecce",
          200: "#ebd99f",
          300: "#e1c269",
          400: "#d6ad3d",
          500: "#c59a2a", // refined metallic gold
          600: "#aa7e20",
          700: "#865e1c",
          800: "#704c1c",
          900: "#5f401d",
        },
        // Semantic shadcn/ui tokens (Light Theme)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 10px -2px rgba(44, 62, 51, 0.05), 0 1px 3px -1px rgba(44, 62, 51, 0.03)",
        card: "0 4px 20px -4px rgba(68, 105, 84, 0.08), 0 2px 6px -2px rgba(44, 62, 51, 0.03)",
        elevated: "0 12px 32px -6px rgba(44, 62, 51, 0.12), 0 4px 12px -2px rgba(44, 62, 51, 0.06)",
        gold: "0 4px 16px -2px rgba(197, 154, 42, 0.25)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
