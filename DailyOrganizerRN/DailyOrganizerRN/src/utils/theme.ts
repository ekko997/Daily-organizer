/**
 * Shared design tokens. Import these instead of hardcoding colors/spacing
 * so the whole app stays visually consistent as it grows.
 */
export const colors = {
  background: '#FFFFFF',
  surface: '#F5F5F7',
  surfaceDark: '#111113',
  border: '#EDEDEF',
  textPrimary: '#111113',
  textSecondary: '#8C8C90',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#D9D9DE',
  accent: '#5973E6',
  holiday: '#D9435C',
  holidayBg: 'rgba(217,67,92,0.12)',
};

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
