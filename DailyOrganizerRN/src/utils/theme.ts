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

// Shared elevation for cards — subtle by design, gives depth without
// looking heavy. Works on both iOS (shadow*) and Android (elevation).
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

export const cardShadowDark = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 4,
};

export const typography = {
  greeting: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Manrope_700Bold' },
  screenTitle: { fontSize: 26, fontWeight: '800' as const, fontFamily: 'Manrope_800ExtraBold' },
  sectionHeader: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'Manrope_700Bold' },
  cardTitle: { fontSize: 18, fontWeight: '700' as const, fontFamily: 'Manrope_700Bold' },
  body: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
};

export type ThemeMode = 'light' | 'dark';

// Warm, grounded palette — pine and linen instead of the generic
// indigo-on-white/near-black look most calendar apps default to.
// "surfaceDark" is the emphasis/selected-state color (Next Up card,
// selected calendar day, active toggle) — it's genuinely the pine accent
// in light mode, and a lighter sage in dark mode so it still reads as
// "emphasis" against a dark background.
const lightColors = {
  background: '#FAF8F4',
  surface: '#F0EBE2',
  surfaceDark: '#022515',
  border: '#E5DFD3',
  textPrimary: '#211F1B',
  textSecondary: '#8A8378',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#CFE0D7',
  accent: '#022515',
  holiday: '#B14A38',
  holidayBg: 'rgba(177,74,56,0.12)',
  white: '#FFFFFF',
};

const darkColors = {
  background: '#17151A',
  surface: '#211E24',
  surfaceDark: '#83B9A0',
  border: '#2E2A33',
  textPrimary: '#F2EFEA',
  textSecondary: '#9C948A',
  textOnDark: '#17151A',
  textOnDarkMuted: '#3E4A44',
  accent: '#83B9A0',
  holiday: '#E1795F',
  holidayBg: 'rgba(225,121,95,0.16)',
  white: '#FFFFFF',
};

export function getColors(mode: ThemeMode) {
  return mode === 'dark' ? darkColors : lightColors;
}

export type ThemeColors = ReturnType<typeof getColors>;
