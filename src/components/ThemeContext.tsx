import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  customColors: ThemeColors | null;
  setCustomColors: (colors: ThemeColors) => void;
  resetColors: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const defaultColors: ThemeColors = {
  primary: '#dc2626',    // Red
  secondary: '#3b82f6',  // Blue
  accent: '#ffffff',     // White
  background: '#ffffff',
  foreground: '#0f172a'
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored as Theme;
      }
    }
    return 'system';
  });

  const [isDark, setIsDark] = useState(false);
  
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

  const setCustomColors = (colors: ThemeColors) => {
    setCustomColorsState(colors);
    localStorage.setItem('customThemeColors', JSON.stringify(colors));
  };

  const resetColors = () => {
    setCustomColorsState(null);
    localStorage.removeItem('customThemeColors');
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
        root.style.setProperty('--primary', customColors.primary);
        root.style.setProperty('--secondary', customColors.secondary);
        root.style.setProperty('--accent', customColors.accent);
        
        // Convert hex to HSL for better theme integration
        const primaryHSL = hexToHSL(customColors.primary);
        root.style.setProperty('--primary-hsl', primaryHSL);
      } else {
        // Reset to default
        root.style.removeProperty('--primary');
        root.style.removeProperty('--secondary');
        root.style.removeProperty('--accent');
        root.style.removeProperty('--primary-hsl');
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
    setTheme,
    isDark,
    customColors,
    setCustomColors,
    resetColors,
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

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}