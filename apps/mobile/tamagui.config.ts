import { createFont, createTamagui } from 'tamagui';
import { config } from '@tamagui/config/v3';
import { neutrals } from './src/theme/neutrals';

// Native platforms pick a font file per weight (no synthetic bolding), so every
// weight used in the app maps to a loaded face (see src/app/_layout.tsx).
// 800/900 map to Bold to keep hierarchy calm.
const bodyFont = createFont({
  ...config.fonts.body,
  family: 'Inter_400Regular',
  face: {
    300: { normal: 'Inter_400Regular' },
    400: { normal: 'Inter_400Regular' },
    500: { normal: 'Inter_500Medium' },
    600: { normal: 'Inter_600SemiBold' },
    700: { normal: 'Inter_700Bold' },
    800: { normal: 'Inter_700Bold' },
    900: { normal: 'Inter_700Bold' },
  },
});

const headingFont = createFont({
  ...config.fonts.heading,
  family: 'PlusJakartaSans_700Bold',
  face: {
    400: { normal: 'PlusJakartaSans_600SemiBold' },
    500: { normal: 'PlusJakartaSans_600SemiBold' },
    600: { normal: 'PlusJakartaSans_600SemiBold' },
    700: { normal: 'PlusJakartaSans_700Bold' },
    800: { normal: 'PlusJakartaSans_800ExtraBold' },
    900: { normal: 'PlusJakartaSans_800ExtraBold' },
  },
});

// Neutral tokens are static per mode. Brand/status colors follow the user's synced
// theme at runtime via useAppColors(); `primary` here is only the default fallback.
export const tamaguiConfig = createTamagui({
  ...config,
  fonts: {
    ...config.fonts,
    body: bodyFont,
    heading: headingFont,
  },
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      background: neutrals.light.background,
      cardBackground: neutrals.light.surface,
      primary: '#dc2626',
      borderColor: neutrals.light.border,
      color: neutrals.light.text,
      colorHover: neutrals.light.text,
      colorPress: neutrals.light.textMuted,
      placeholderColor: neutrals.light.textSubtle,
      shadowColor: 'rgba(17, 24, 39, 0.06)',
    },
    dark: {
      ...config.themes.dark,
      background: neutrals.dark.background,
      cardBackground: neutrals.dark.surface,
      primary: '#ef4444',
      borderColor: neutrals.dark.border,
      color: neutrals.dark.text,
      colorHover: neutrals.dark.text,
      colorPress: neutrals.dark.textMuted,
      placeholderColor: neutrals.dark.textSubtle,
      shadowColor: 'rgba(0, 0, 0, 0.35)',
    },
  },
});

export type Conf = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

export default tamaguiConfig;
