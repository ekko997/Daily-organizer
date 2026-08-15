export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 16,
  pill: 20,
};

export const typography = {
  greeting: { fontSize: 15, fontWeight: '500' as const },
  screenTitle: { fontSize: 26, fontWeight: '700' as const },
  sectionHeader: { fontSize: 16, fontWeight: '600' as const },
  cardTitle: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
};

export type ThemeMode = 'light' | 'dark';

const lightColors = {
  background: '#FFFFFF',
  surface: '#F5F5F7',
  // "emphasis" surface used for selected states / callout cards — inverts in dark mode
  surfaceDark: '#111113',
  border: '#EDEDEF',
  textPrimary: '#111113',
  textSecondary: '#8C8C90',
  // text that sits on top of surfaceDark — inverts alongside it
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#D9D9DE',
  accent: '#5973E6',
  holiday: '#D9435C',
  holidayBg: 'rgba(217,67,92,0.12)',
  // constant white — for text/icons on vividly-colored buttons/badges that don't flip with theme
  white: '#FFFFFF',
};

const darkColors = {
  background: '#0B0B0D',
  surface: '#1C1C1F',
  surfaceDark: '#F2F2F3',
  border: '#2C2C30',
  textPrimary: '#F2F2F3',
  textSecondary: '#9A9A9E',
  textOnDark: '#111113',
  textOnDarkMuted: '#4A4A4D',
  accent: '#7B93F0',
  holiday: '#FF6B82',
  holidayBg: 'rgba(255,107,130,0.16)',
  white: '#FFFFFF',
};

export function getColors(mode: ThemeMode) {
  return mode === 'dark' ? darkColors : lightColors;
}

export type ThemeColors = ReturnType<typeof getColors>;
