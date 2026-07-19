/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
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
          border: "var(--border)",
          input: "var(--input)",
          ring: "var(--ring)",
          background: "var(--background)",
          foreground: "var(--foreground)",
          primary: {
            DEFAULT: "var(--primary)",
            foreground: "var(--primary-foreground)",
          },
          secondary: {
            DEFAULT: "var(--secondary)",
            foreground: "var(--secondary-foreground)",
          },
          destructive: {
            DEFAULT: "var(--destructive)",
            foreground: "var(--destructive-foreground)",
          },
          muted: {
            DEFAULT: "var(--muted)",
            foreground: "var(--muted-foreground)",
          },
          accent: {
            DEFAULT: "var(--accent)",
            foreground: "var(--accent-foreground)",
          },
          popover: {
            DEFAULT: "var(--popover)",
            foreground: "var(--popover-foreground)",
          },
          card: {
            DEFAULT: "var(--card)",
            foreground: "var(--card-foreground)",
          },
          sidebar: {
            DEFAULT: "var(--sidebar)",
            foreground: "var(--sidebar-foreground)",
            primary: "var(--sidebar-primary)",
            "primary-foreground": "var(--sidebar-primary-foreground)",
            accent: "var(--sidebar-accent)",
            "accent-foreground": "var(--sidebar-accent-foreground)",
            border: "var(--sidebar-border)",
            ring: "var(--sidebar-ring)",
          },
        },
        borderRadius: {
          lg: "var(--radius)",
          md: "calc(var(--radius) - 2px)",
          sm: "calc(var(--radius) - 4px)",
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
