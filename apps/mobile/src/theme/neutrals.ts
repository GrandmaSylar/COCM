// ============================================================================
// NEUTRALS — fixed per mode (one cool-gray family). Brand/status colors come
// from the user's synced theme instead (see buildAppColors).
// ============================================================================

export const neutrals = {
  light: {
    background: '#F5F6F8',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF0F3',
    border: '#E3E6EB',
    borderStrong: '#CDD2DA',
    text: '#111827',
    textMuted: '#5B6473',
    textSubtle: '#8A93A3',
    overlay: 'rgba(15, 17, 21, 0.45)',
  },
  dark: {
    background: '#0F1115',
    surface: '#171A21',
    surfaceMuted: '#1F232C',
    border: '#272C36',
    borderStrong: '#363C48',
    text: '#F2F4F7',
    textMuted: '#A3ACBA',
    textSubtle: '#717A8A',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;
