export interface ThemePreset {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string; // Used for preview only
  };
  fullColors: {
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
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'CoC.M Default',
    colors: {
      primary: '#dc2626',
      secondary: '#3b82f6',
      accent: '#8b5cf6',
      background: '#ffffff'
    },
    fullColors: {
      primary: '#dc2626',
      secondary: '#3b82f6',
      accent: '#8b5cf6',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#0ea5e9',
      muted: '#6b7280',
      border: '#e5e7eb',
      chart1: '#dc2626',
      chart2: '#3b82f6',
      chart3: '#22c55e',
      chart4: '#f59e0b',
      chart5: '#8b5cf6'
    }
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: {
      primary: '#0ea5e9',
      secondary: '#6366f1',
      accent: '#06b6d4',
      background: '#f0f9ff'
    },
    fullColors: {
      primary: '#0ea5e9',
      secondary: '#6366f1',
      accent: '#06b6d4',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      muted: '#64748b',
      border: '#cbd5e1',
      chart1: '#0ea5e9',
      chart2: '#6366f1',
      chart3: '#06b6d4',
      chart4: '#3b82f6',
      chart5: '#10b981'
    }
  },
  {
    id: 'forest',
    name: 'Forest Sanctuary',
    colors: {
      primary: '#16a34a',
      secondary: '#15803d',
      accent: '#84cc16',
      background: '#f0fdf4'
    },
    fullColors: {
      primary: '#16a34a',
      secondary: '#15803d',
      accent: '#84cc16',
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
      info: '#06b6d4',
      muted: '#57534e',
      border: '#d6d3d1',
      chart1: '#16a34a',
      chart2: '#15803d',
      chart3: '#84cc16',
      chart4: '#22c55e',
      chart5: '#eab308'
    }
  },
  {
    id: 'royal',
    name: 'Royal Purple',
    colors: {
      primary: '#7c3aed',
      secondary: '#c026d3',
      accent: '#4f46e5',
      background: '#faf5ff'
    },
    fullColors: {
      primary: '#7c3aed',
      secondary: '#c026d3',
      accent: '#4f46e5',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#f43f5e',
      info: '#3b82f6',
      muted: '#6b7280',
      border: '#e5e7eb',
      chart1: '#7c3aed',
      chart2: '#c026d3',
      chart3: '#4f46e5',
      chart4: '#9333ea',
      chart5: '#d946ef'
    }
  },
  {
    id: 'sunset',
    name: 'Sunset Horizon',
    colors: {
      primary: '#f97316',
      secondary: '#e11d48',
      accent: '#f59e0b',
      background: '#fff7ed'
    },
    fullColors: {
      primary: '#f97316',
      secondary: '#e11d48',
      accent: '#f59e0b',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#0ea5e9',
      muted: '#78716c',
      border: '#e7e5e4',
      chart1: '#f97316',
      chart2: '#e11d48',
      chart3: '#f59e0b',
      chart4: '#db2777',
      chart5: '#ea580c'
    }
  },
  {
    id: 'monochrome',
    name: 'Monochrome Slate',
    colors: {
      primary: '#334155',
      secondary: '#475569',
      accent: '#94a3b8',
      background: '#f8fafc'
    },
    fullColors: {
      primary: '#334155',
      secondary: '#475569',
      accent: '#94a3b8',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#0284c7',
      muted: '#64748b',
      border: '#cbd5e1',
      chart1: '#334155',
      chart2: '#475569',
      chart3: '#64748b',
      chart4: '#94a3b8',
      chart5: '#1e293b'
    }
  }
];
