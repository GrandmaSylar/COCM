import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultThemeColors, ThemeColors, ThemeModePreference } from '@cms/shared';
import { api, invalidateApiCache } from '../lib/api';
import { supabase } from '../lib/supabase';
import { AppColors, buildAppColors } from '../theme/tokens';

/** Resolved mode actually rendered. */
export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  /** Resolved mode ('system' already applied). */
  themeMode: ThemeMode;
  isDark: boolean;
  /** What the user picked: light, dark or follow the device. Synced with the web app. */
  preference: ThemeModePreference;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeModePreference) => void;
  /** The user's synced theme colors (null = CoC.M default). */
  customColors: ThemeColors | null;
  setCustomColors: (colors: ThemeColors) => void;
  resetColors: () => void;
  /** Temporarily render the whole app with these colors without saving (theme editor). null clears. */
  previewColors: (colors: ThemeColors | null) => void;
  isPreviewing: boolean;
  /** Re-pull the theme from the server (e.g. right after login). */
  refreshFromServer: () => Promise<void>;
  isSyncing: boolean;
  /** Full derived palette for the current mode — use this in new UI. */
  colors: AppColors;
  /** Legacy shape used by existing screens; now derived from the same palette. */
  themeColors: {
    background: string;
    cardBackground: string;
    headerBackground: string;
    text: string;
    textMuted: string;
    borderColor: string;
    tabBarBackground: string;
    tabBarBorder: string;
    statusBarStyle: 'light-content' | 'dark-content';
  };
}

const MODE_KEY = '@cocm_app_theme_mode';
const COLORS_KEY = '@cocm_theme_colors';
/** Set when a local change couldn't reach the server yet (pushed before the next pull). */
const PENDING_KEY = '@cocm_theme_pending_sync';

function legacyColors(colors: AppColors): ThemeContextType['themeColors'] {
  return {
    background: colors.background,
    cardBackground: colors.surface,
    headerBackground: colors.surface,
    text: colors.text,
    textMuted: colors.textMuted,
    borderColor: colors.border,
    tabBarBackground: colors.surface,
    tabBarBorder: colors.border,
    statusBarStyle: colors.isDark ? 'light-content' : 'dark-content',
  };
}

const defaultAppColors = buildAppColors(defaultThemeColors, false);

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'light',
  isDark: false,
  preference: 'system',
  toggleTheme: () => {},
  setThemeMode: () => {},
  customColors: null,
  setCustomColors: () => {},
  resetColors: () => {},
  previewColors: () => {},
  isPreviewing: false,
  refreshFromServer: async () => {},
  isSyncing: false,
  colors: defaultAppColors,
  themeColors: legacyColors(defaultAppColors),
});

async function hasSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemeModePreference>('system');
  const [customColors, setCustomColorsState] = useState<ThemeColors | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [preview, setPreview] = useState<ThemeColors | null>(null);

  // Latest values for the async server sync (avoids stale closures)
  const stateRef = useRef({ preference, customColors });
  stateRef.current = { preference, customColors };

  // 1. Instant start from the on-device copy
  useEffect(() => {
    AsyncStorage.multiGet([MODE_KEY, COLORS_KEY])
      .then(([[, mode], [, colors]]) => {
        if (mode === 'light' || mode === 'dark' || mode === 'system') setPreference(mode);
        if (colors) {
          try { setCustomColorsState(JSON.parse(colors)); } catch {}
        }
      })
      .catch(err => console.warn('Failed to load saved theme:', err));
  }, []);

  const persistLocal = (mode: ThemeModePreference, colors: ThemeColors | null) => {
    AsyncStorage.setItem(MODE_KEY, mode).catch(() => {});
    if (colors) AsyncStorage.setItem(COLORS_KEY, JSON.stringify(colors)).catch(() => {});
    else AsyncStorage.removeItem(COLORS_KEY).catch(() => {});
  };

  const pushToServer = useCallback(async (mode: ThemeModePreference, colors: ThemeColors | null) => {
    if (!(await hasSession())) return;
    setIsSyncing(true);
    try {
      await api.theme.save({ colors, mode });
      await AsyncStorage.removeItem(PENDING_KEY);
    } catch (err) {
      console.warn('Theme saved locally; will sync when online:', err);
      await AsyncStorage.setItem(PENDING_KEY, '1').catch(() => {});
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // 2. Server copy (shared with the web app) wins, unless a local change is still unsynced
  const refreshFromServer = useCallback(async () => {
    if (!(await hasSession())) return;
    try {
      if (await AsyncStorage.getItem(PENDING_KEY)) {
        const { preference: mode, customColors: colors } = stateRef.current;
        await pushToServer(mode, colors);
        return;
      }
      invalidateApiCache('/theme');
      const data = await api.theme.get();
      const mode = data?.mode === 'light' || data?.mode === 'dark' || data?.mode === 'system' ? data.mode : 'system';
      const colors: ThemeColors | null = data?.colors ? { ...defaultThemeColors, ...data.colors } : null;
      setPreference(mode);
      setCustomColorsState(colors);
      persistLocal(mode, colors);
    } catch (err) {
      console.log('Theme sync: using on-device settings');
    }
  }, [pushToServer]);

  useEffect(() => {
    refreshFromServer();
    // Pick up changes made on the web whenever the app returns to the foreground
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshFromServer();
    });
    return () => sub.remove();
  }, [refreshFromServer]);

  const setThemeMode = useCallback((mode: ThemeModePreference) => {
    setPreference(mode);
    persistLocal(mode, stateRef.current.customColors);
    pushToServer(mode, stateRef.current.customColors);
  }, [pushToServer]);

  const setCustomColors = useCallback((colors: ThemeColors) => {
    setPreview(null);
    setCustomColorsState(colors);
    persistLocal(stateRef.current.preference, colors);
    pushToServer(stateRef.current.preference, colors);
  }, [pushToServer]);

  const resetColors = useCallback(() => {
    setPreview(null);
    setCustomColorsState(null);
    persistLocal(stateRef.current.preference, null);
    pushToServer(stateRef.current.preference, null);
  }, [pushToServer]);

  const themeMode: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const isDark = themeMode === 'dark';

  const toggleTheme = useCallback(() => {
    setThemeMode(isDark ? 'light' : 'dark');
  }, [isDark, setThemeMode]);

  const colors = useMemo(
    () => buildAppColors(preview ?? customColors ?? defaultThemeColors, isDark),
    [preview, customColors, isDark]
  );

  const value = useMemo<ThemeContextType>(() => ({
    themeMode,
    isDark,
    preference,
    toggleTheme,
    setThemeMode,
    customColors,
    setCustomColors,
    resetColors,
    previewColors: setPreview,
    isPreviewing: preview !== null,
    refreshFromServer,
    isSyncing,
    colors,
    themeColors: legacyColors(colors),
  }), [themeMode, isDark, preference, toggleTheme, setThemeMode, customColors, setCustomColors, resetColors, preview, refreshFromServer, isSyncing, colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  return useContext(ThemeContext);
}

/** Derived palette for the current mode and the user's synced theme. */
export function useAppColors(): AppColors {
  return useContext(ThemeContext).colors;
}
