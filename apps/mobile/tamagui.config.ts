import { createTamagui } from 'tamagui';
import { config } from '@tamagui/config/v3';

export const tamaguiConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      background: '#F8F9FA',
      cardBackground: '#FFFFFF',
      primary: '#007AFF',
      borderColor: '#E5E5EA',
      color: '#1C1C1E',
      colorHover: '#3A3A3C',
      colorPress: '#8E8E93',
      shadowColor: 'rgba(0, 0, 0, 0.05)',
    },
    dark: {
      ...config.themes.dark,
      background: '#121212',
      cardBackground: '#1C1C1E',
      primary: '#0A84FF',
      borderColor: '#2C2C2E',
      color: '#FFFFFF',
      colorHover: '#E5E5EA',
      colorPress: '#8E8E93',
      shadowColor: 'rgba(0, 0, 0, 0.3)',
    },
  },
});

export type Conf = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

export default tamaguiConfig;
