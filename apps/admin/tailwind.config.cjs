/** @type {import('tailwindcss').Config} */
// Colors, radii and type sizes are CSS variables set by ThemeProvider from the
// shared design tokens (@cms/shared/design), so this app matches the Expo app
// in light and dark mode and with the user's own theme colors.
const tone = (name) => ({
  DEFAULT: `var(--c-${name})`,
  soft: `var(--c-${name}-soft)`,
  pressed: `var(--c-${name}-pressed)`,
  on: `var(--c-${name}-on)`,
  text: `var(--c-${name}-text)`,
});

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--c-background)',
        surface: 'var(--c-surface)',
        'surface-muted': 'var(--c-surface-muted)',
        border: 'var(--c-border)',
        strong: 'var(--c-border-strong)',
        ink: 'var(--c-text)',
        muted: 'var(--c-text-muted)',
        subtle: 'var(--c-text-subtle)',
        overlay: 'var(--c-overlay)',
        primary: tone('primary'),
        success: tone('success'),
        warning: tone('warning'),
        danger: tone('danger'),
        info: tone('info'),
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
