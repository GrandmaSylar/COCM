import type { ThemeColors } from '../theme';
import { ensureContrast, mix, normalizeHex, readableOn, withAlpha } from './color';

import { neutrals } from './neutrals';

export { neutrals };

// ============================================================================
// TYPE, SPACING, RADIUS, MOTION
// ============================================================================

// Font families are platform specific, so they stay with each app. The sizes
// below are shared.
/** 6-step scale: [fontSize, lineHeight]. Nothing below `micro`. */
export const typeScale = {
  display: { fontSize: 28, lineHeight: 34 },
  title: { fontSize: 20, lineHeight: 26 },
  headline: { fontSize: 17, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 21 },
  caption: { fontSize: 13, lineHeight: 18 },
  micro: { fontSize: 11, lineHeight: 14 },
} as const;

/** 4pt grid. */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  /**
   * Shared spring (react-native-reanimated withSpring). Critically damped with
   * overshoot clamped: settles quickly and never bounces.
   */
  spring: { damping: 36, stiffness: 320, mass: 1, overshootClamping: true },
  /** Small entrance offset for toasts and content (px). */
  enterOffset: 12,
  pressScale: 0.97,
} as const;

/** Minimum touch target (iOS HIG / Material). */
export const HIT = 44;

// ============================================================================
// DERIVED APP COLORS
// ============================================================================

export interface ToneColors {
  /** The color itself (fills, icons on soft backgrounds). */
  base: string;
  /** Tinted background for pills, chips, icon wells. */
  soft: string;
  /** Pressed state of a filled control. */
  pressed: string;
  /** Text/icon color that reads on `base`. */
  on: string;
  /** Legible version for text on the page surface. */
  text: string;
}

export interface AppColors {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  overlay: string;
  primary: ToneColors;
  secondary: ToneColors;
  accent: ToneColors;
  success: ToneColors;
  warning: ToneColors;
  danger: ToneColors;
  info: ToneColors;
  chart: [string, string, string, string, string];
}

function tone(color: string, isDark: boolean, surface: string): ToneColors {
  const base = normalizeHex(color);
  return {
    base,
    soft: withAlpha(base, isDark ? 0.18 : 0.1),
    pressed: mix(base, isDark ? '#FFFFFF' : '#000000', 0.14),
    on: readableOn(base),
    text: ensureContrast(base, surface),
  };
}

/**
 * Turns the 14 synced theme colors into everything the mobile UI needs for the
 * current mode. The web's `muted`/`border` are tuned for light backgrounds, so
 * they only replace the neutrals in light mode.
 */
export function buildAppColors(theme: ThemeColors, isDark: boolean): AppColors {
  const n = isDark ? neutrals.dark : neutrals.light;
  const surface = n.surface;
  return {
    isDark,
    ...n,
    border: isDark ? n.border : normalizeHex(theme.border, n.border),
    textMuted: isDark ? n.textMuted : ensureContrast(normalizeHex(theme.muted, n.textMuted), surface),
    primary: tone(theme.primary, isDark, surface),
    secondary: tone(theme.secondary, isDark, surface),
    accent: tone(theme.accent, isDark, surface),
    success: tone(theme.success, isDark, surface),
    warning: tone(theme.warning, isDark, surface),
    danger: tone(theme.error, isDark, surface),
    info: tone(theme.info, isDark, surface),
    chart: [theme.chart1, theme.chart2, theme.chart3, theme.chart4, theme.chart5].map(c =>
      normalizeHex(c)
    ) as AppColors['chart'],
  };
}
