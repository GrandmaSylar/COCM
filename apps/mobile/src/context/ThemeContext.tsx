import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
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

const STORAGE_KEY = '@cocm_app_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'light',
  isDark: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
  themeColors: {
    background: '#F8F9FA',
    cardBackground: '#FFFFFF',
    headerBackground: '#FFFFFF',
    text: '#1C1C1E',
    textMuted: '#8E8E93',
    borderColor: '#E5E5EA',
    tabBarBackground: '#FFFFFF',
    tabBarBorder: '#E5E5EA',
    statusBarStyle: 'dark-content',
  },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(systemColorScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    // Load persisted theme preference
    AsyncStorage.getItem(STORAGE_KEY)
      .then((savedMode) => {
        if (savedMode === 'dark' || savedMode === 'light') {
          setThemeModeState(savedMode);
        }
      })
      .catch((err) => {
        console.warn('Failed to load saved theme mode:', err);
      });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch((err) => {
      console.warn('Failed to save theme mode:', err);
    });
  };

  const toggleTheme = () => {
    const nextMode = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  };

  const isDark = themeMode === 'dark';

  const themeColors = {
    background: isDark ? '#121212' : '#F8F9FA',
    cardBackground: isDark ? '#1C1C1E' : '#FFFFFF',
    headerBackground: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1C1C1E',
    textMuted: isDark ? '#98989E' : '#8E8E93',
    borderColor: isDark ? '#2C2C2E' : '#E5E5EA',
    tabBarBackground: isDark ? '#1C1C1E' : '#FFFFFF',
    tabBarBorder: isDark ? '#2C2C2E' : '#E5E5EA',
    statusBarStyle: (isDark ? 'light-content' : 'dark-content') as 'light-content' | 'dark-content',
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        toggleTheme,
        setThemeMode,
        themeColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return useContext(ThemeContext);
}
