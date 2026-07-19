import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api } from '../services/api';
import { supabase } from '@cms/shared';

type Theme = 'light' | 'dark' | 'system';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  border: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  customColors: ThemeColors | null;
  setCustomColors: (colors: ThemeColors) => void;
  resetColors: () => void;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const defaultColors: ThemeColors = {
  primary: '#dc2626',    // Red
  secondary: '#3b82f6',  // Blue
  accent: '#3b82f6',     // Blue
  success: '#22c55e',    // Green
  warning: '#f59e0b',    // Amber
  error: '#ef4444',      // Red
  info: '#0ea5e9',       // Sky blue
  muted: '#6b7280',      // Gray
  border: '#e5e7eb',     // Light gray
  chart1: '#dc2626',     // Red
  chart2: '#3b82f6',     // Blue
  chart3: '#22c55e',     // Green
  chart4: '#f59e0b',     // Amber
  chart5: '#3b82f6',     // Blue
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored as Theme;
      }
    }
    return 'system';
  });

  const [isDark, setIsDark] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [customColors, setCustomColorsState] = useState<ThemeColors | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('customThemeColors');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  // Fetch theme from server on mount
  const fetchThemeFromServer = useCallback(async () => {
    // Only fetch if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const data = await api.theme.get();
      if (data?.colors) {
        setCustomColorsState(data.colors);
        localStorage.setItem('customThemeColors', JSON.stringify(data.colors));
        setLastSyncedAt(new Date());
      }
      if (data?.mode) {
        setTheme(data.mode);
        localStorage.setItem('theme', data.mode);
      }
    } catch (err) {
      // Silent fail - use local storage as fallback
      console.log('Theme sync: using local settings');
    }
  }, []);

  // Sync theme to server
  const syncThemeToServer = useCallback(async (colors: ThemeColors | null, mode: Theme) => {
    // Only sync if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setIsSyncing(true);
    try {
      await api.theme.save({ colors, mode });
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to sync theme to server:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Initial fetch from server
  useEffect(() => {
    fetchThemeFromServer();
  }, [fetchThemeFromServer]);

  // Poll for theme updates every 30 seconds (for cross-device sync)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchThemeFromServer();
    }, 30000);
    return () => clearInterval(pollInterval);
  }, [fetchThemeFromServer]);

  const setCustomColors = (colors: ThemeColors) => {
    setCustomColorsState(colors);
    localStorage.setItem('customThemeColors', JSON.stringify(colors));
    syncThemeToServer(colors, theme);
  };

  const resetColors = () => {
    setCustomColorsState(null);
    localStorage.removeItem('customThemeColors');
    syncThemeToServer(null, theme);
  };

  // Sync theme mode changes to server
  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    syncThemeToServer(customColors, newTheme);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    
    const updateTheme = () => {
      root.classList.remove('light', 'dark');
      
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
        setIsDark(systemTheme === 'dark');
      } else {
        root.classList.add(theme);
        setIsDark(theme === 'dark');
      }
      
      // Apply custom colors if set
      if (customColors) {
        // Main colors
        root.style.setProperty('--primary', customColors.primary);
        root.style.setProperty('--secondary', customColors.secondary);
        root.style.setProperty('--accent', customColors.accent);

        // Status colors
        root.style.setProperty('--success', customColors.success);
        root.style.setProperty('--warning', customColors.warning);
        root.style.setProperty('--error', customColors.error);
        root.style.setProperty('--info', customColors.info);

        // UI colors
        root.style.setProperty('--muted-custom', customColors.muted);
        root.style.setProperty('--border-custom', customColors.border);

        // Chart colors
        root.style.setProperty('--chart-1', customColors.chart1);
        root.style.setProperty('--chart-2', customColors.chart2);
        root.style.setProperty('--chart-3', customColors.chart3);
        root.style.setProperty('--chart-4', customColors.chart4);
        root.style.setProperty('--chart-5', customColors.chart5);

        // Convert hex to HSL for better theme integration
        const primaryHSL = hexToHSL(customColors.primary);
        const secondaryHSL = hexToHSL(customColors.secondary);
        root.style.setProperty('--primary-hsl', primaryHSL);
        root.style.setProperty('--secondary-hsl', secondaryHSL);

        // Set gradient end color: use accent if it differs from primary, else lighten primary
        const gradientEnd = customColors.accent !== customColors.primary
          ? customColors.accent
          : lightenHex(customColors.primary, 30);
        root.style.setProperty('--primary-gradient-end', gradientEnd);
      } else {
        // Reset all custom properties
        const props = [
          '--primary', '--secondary', '--accent',
          '--success', '--warning', '--error', '--info',
          '--muted-custom', '--border-custom',
          '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
          '--primary-hsl', '--secondary-hsl', '--primary-gradient-end'
        ];
        props.forEach(prop => root.style.removeProperty(prop));
      }
    };

    updateTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    
    // Store theme preference
    localStorage.setItem('theme', theme);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, customColors]);

  const value = {
    theme,
    setTheme: handleSetTheme,
    isDark,
    customColors,
    setCustomColors,
    resetColors,
    isSyncing,
    lastSyncedAt,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Helper function to convert hex to HSL
function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Helper: lighten a hex color by a given amount (0-100)
function lightenHex(hex: string, amount: number): string {
  hex = hex.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.min(255, Math.round(r + (255 - r) * (amount / 100)));
  g = Math.min(255, Math.round(g + (255 - g) * (amount / 100)));
  b = Math.min(255, Math.round(b + (255 - b) * (amount / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}