import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
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
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        link: "hsl(var(--link))",
        slate: "hsl(var(--slate))",
        graphite: "hsl(var(--graphite))",
        silver: "hsl(var(--silver))",
        obsidian: "hsl(var(--obsidian))",
        // Named Aqua tokens
        "sky-signal": "#67beff",
        "electric-iris": "#4288ff",
        "paper-white": "#fafbfc",
        mist: "#f3f7fa",
        fog: "#f2f6fa",
        linen: "#e5e8ec",
        ash: "#efefef",
        inkstone: "#292c3d",
        pewter: "#686a76",
        midnight: "#1e1e20",
      },
      boxShadow: {
        subtle: "var(--shadow-subtle)",
        panel: "var(--shadow-panel)",
        float: "var(--shadow-float)",
        // legacy names mapped to the quiet elevation scale
        soft: "var(--shadow-subtle)",
        water: "var(--shadow-panel)",
        glow: "var(--shadow-panel)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        heading: ["var(--font-sans)"],
        body: ["var(--font-sans)"],
      },
      fontSize: {
        caption: ["11px", { lineHeight: "1.4" }],
        body: ["16px", { lineHeight: "1.5" }],
        subheading: ["20px", { lineHeight: "1.4" }],
        "heading-sm": ["24px", { lineHeight: "1.2" }],
        heading: ["40px", { lineHeight: "1.1" }],
        "heading-lg": ["56px", { lineHeight: "1.1" }],
        display: ["72px", { lineHeight: "1" }],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      maxWidth: {
        page: "1200px",
        prose: "680px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.5s cubic-bezier(0.2, 0, 0, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
