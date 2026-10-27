import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildAppColors, radius, typeScale, type AppColors } from '@cms/shared/design';
import { defaultThemeColors, type ThemeColors, type ThemeModePreference } from '@cms/shared/theme';

const MODE_KEY = 'cocm-admin-theme-mode';
const TONES = ['primary', 'success', 'warning', 'danger', 'info'] as const;

function readStoredMode(): ThemeModePreference | null {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : null;
  } catch {
    return null;
  }
}

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Writes the palette and the shared scales as CSS variables (see tailwind.config.cjs).
function writeVariables(colors: AppColors) {
  const root = document.documentElement;
  const set = (name: string, value: string) => root.style.setProperty(name, value);

  set('--c-background', colors.background);
  set('--c-surface', colors.surface);
  set('--c-surface-muted', colors.surfaceMuted);
  set('--c-border', colors.border);
  set('--c-border-strong', colors.borderStrong);
  set('--c-text', colors.text);
  set('--c-text-muted', colors.textMuted);
  set('--c-text-subtle', colors.textSubtle);
  set('--c-overlay', colors.overlay);
  for (const tone of TONES) {
    const t = colors[tone];
    set(`--c-${tone}`, t.base);
    set(`--c-${tone}-soft`, t.soft);
    set(`--c-${tone}-pressed`, t.pressed);
    set(`--c-${tone}-on`, t.on);
    set(`--c-${tone}-text`, t.text);
  }
  for (const [name, value] of Object.entries(radius)) set(`--r-${name}`, `${value}px`);
  for (const [name, { fontSize, lineHeight }] of Object.entries(typeScale)) {
    set(`--fs-${name}`, `${fontSize}px`);
    set(`--lh-${name}`, `${lineHeight}px`);
  }
  root.style.colorScheme = colors.isDark ? 'dark' : 'light';
}

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
  preference: ThemeModePreference;
  toggle: () => void;
  /** Adopt the colors (and, unless the person already picked one here, the mode) saved in the Expo/web app. */
  applySynced: (colors: Partial<ThemeColors> | null, mode: ThemeModePreference | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [localMode, setLocalMode] = useState<ThemeModePreference | null>(readStoredMode);
  const [syncedMode, setSyncedMode] = useState<ThemeModePreference | null>(null);
  const [custom, setCustom] = useState<Partial<ThemeColors> | null>(null);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const preference: ThemeModePreference = localMode ?? syncedMode ?? 'system';
  const isDark = preference === 'dark' || (preference === 'system' && systemDark);

  const colors = useMemo(() => buildAppColors({ ...defaultThemeColors, ...(custom ?? {}) }, isDark), [custom, isDark]);

  useEffect(() => writeVariables(colors), [colors]);

  const toggle = useCallback(() => {
    const next: ThemeModePreference = isDark ? 'light' : 'dark';
    setLocalMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  }, [isDark]);

  const applySynced = useCallback((synced: Partial<ThemeColors> | null, mode: ThemeModePreference | null) => {
    setCustom(synced);
    setSyncedMode(mode);
  }, []);

  const value = useMemo(() => ({ colors, isDark, preference, toggle, applySynced }), [colors, isDark, preference, toggle, applySynced]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
