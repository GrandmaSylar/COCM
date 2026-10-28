/** @type {import('tailwindcss').Config} */
// The theme colours are plain CSS variables (hex, so the theme editor can override them), which
// Tailwind cannot apply an opacity to: `bg-primary/10` or `hover:bg-primary/90` generated nothing.
// The solid colour stays a plain var(); only the opacity variants use color-mix.
const token = (name) => ({ opacityValue }) => {
  if (opacityValue === undefined) return `var(--${name})`;
  const percent = /^[\d.]+$/.test(String(opacityValue)) ? `${Number(opacityValue) * 100}%` : `calc(${opacityValue} * 100%)`;
  return `color-mix(in srgb, var(--${name}) ${percent}, transparent)`;
};

module.exports = {
    darkMode: ["class"],
    future: { hoverOnlyWhenSupported: true },
    content: [
      "./index.html",
      "./src/**/*.{ts,tsx}",
      "../../packages/shared/src/**/*.{ts,tsx}",
    ],
    theme: {
      container: {
        center: true,
        padding: "2rem",
        screens: {
          "2xl": "1400px",
        },
      },
      extend: {
        fontFamily: {
          sans: ["Inter", "system-ui", "sans-serif"],
          heading: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        },
        fontSize: {
          "mobile-h1": ["1.5rem", { lineHeight: "1.2", fontWeight: "700" }],
          "mobile-h2": ["1.25rem", { lineHeight: "1.3", fontWeight: "700" }],
          "mobile-h3": ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
          "mobile-body": ["1rem", { lineHeight: "1.5" }],
          "mobile-secondary": ["0.875rem", { lineHeight: "1.4" }],
          "mobile-caption": ["0.75rem", { lineHeight: "1.4" }],
        },
        colors: {
          border: token("border"),
          input: token("input"),
          ring: token("ring"),
          background: token("background"),
          foreground: token("foreground"),
          primary: {
            DEFAULT: token("primary"),
            foreground: token("primary-foreground"),
            text: token("primary-text"),
          },
          secondary: {
            DEFAULT: token("secondary"),
            foreground: token("secondary-foreground"),
          },
          destructive: {
            DEFAULT: token("destructive"),
            foreground: token("destructive-foreground"),
          },
          muted: {
            DEFAULT: token("muted"),
            foreground: token("muted-foreground"),
          },
          accent: {
            DEFAULT: token("accent"),
            foreground: token("accent-foreground"),
          },
          success: {
            DEFAULT: token("success"),
            soft: token("success-soft"),
            text: token("success-text"),
          },
          warning: {
            DEFAULT: token("warning"),
            soft: token("warning-soft"),
            text: token("warning-text"),
          },
          info: {
            DEFAULT: token("info"),
            soft: token("info-soft"),
            text: token("info-text"),
          },
          popover: {
            DEFAULT: token("popover"),
            foreground: token("popover-foreground"),
          },
          card: {
            DEFAULT: token("card"),
            foreground: token("card-foreground"),
          },
          sidebar: {
            DEFAULT: token("sidebar"),
            foreground: token("sidebar-foreground"),
            primary: token("sidebar-primary"),
            "primary-foreground": token("sidebar-primary-foreground"),
            accent: token("sidebar-accent"),
            "accent-foreground": token("sidebar-accent-foreground"),
            border: token("sidebar-border"),
            ring: token("sidebar-ring"),
          },
        },
        borderRadius: {
          lg: "var(--radius)",
          md: "calc(var(--radius) - 4px)",
          sm: "calc(var(--radius) - 8px)",
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
            "0%": { opacity: "0", transform: "translateY(10px)" },
            "100%": { opacity: "1", transform: "translateY(0)" },
          },
          "fade-in": {
            "0%": { opacity: "0" },
            "100%": { opacity: "1" },
          },
        },
        animation: {
          "accordion-down": "accordion-down 0.2s ease-out",
          "accordion-up": "accordion-up 0.2s ease-out",
          "fade-up": "fade-up 0.5s ease-out forwards",
          "fade-in": "fade-in 0.3s ease-out forwards",
        },
      },
    },
    plugins: [require("tailwindcss-animate")],
  }
