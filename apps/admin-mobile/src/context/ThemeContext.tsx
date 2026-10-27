import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultThemeColors, type ThemeColors, type ThemeModePreference } from '@cms/shared/theme';
import { buildAppColors, type AppColors } from '../theme/tokens';

const MODE_KEY = '@cocm_admin_theme_mode';

interface ThemeContextValue {
  isDark: boolean;
  /** What the person picked here: light, dark, or follow the phone. */
  preference: ThemeModePreference;
  toggleTheme: () => void;
  /** Full derived palette for the current mode. */
  colors: AppColors;
  /** Adopt the colors (and, unless a mode was picked here, the mode) saved in the main app. Read only. */
  applySynced: (colors: Partial<ThemeColors> | null, mode: ThemeModePreference | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [localMode, setLocalMode] = useState<ThemeModePreference | null>(null);
  const [syncedMode, setSyncedMode] = useState<ThemeModePreference | null>(null);
  const [custom, setCustom] = useState<Partial<ThemeColors> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then((value) => {
        if (value === 'light' || value === 'dark' || value === 'system') setLocalMode(value);
      })
      .catch(() => {});
  }, []);

  const preference: ThemeModePreference = localMode ?? syncedMode ?? 'system';
  const isDark = preference === 'dark' || (preference === 'system' && system === 'dark');

  const colors = useMemo(() => buildAppColors({ ...defaultThemeColors, ...(custom ?? {}) }, isDark), [custom, isDark]);

  const toggleTheme = useCallback(() => {
    const next: ThemeModePreference = isDark ? 'light' : 'dark';
    setLocalMode(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  }, [isDark]);

  const applySynced = useCallback((synced: Partial<ThemeColors> | null, mode: ThemeModePreference | null) => {
    setCustom(synced);
    setSyncedMode(mode);
  }, []);

  const value = useMemo(() => ({ isDark, preference, toggleTheme, colors, applySynced }), [isDark, preference, toggleTheme, colors, applySynced]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemeContext must be used inside ThemeProvider');
  return value;
}

/** The palette for the current mode. Use this in every component, never the raw tokens. */
export const useAppColors = () => useThemeContext().colors;
