import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvents } from '../utils/EventsContext';
import { SUPPORTED_COUNTRIES } from '../services/holidayService';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme, ThemePreference } from '../utils/ThemeContext';

const THEME_OPTIONS: { label: string; value: ThemePreference; icon: string }[] = [
  { label: 'Light', value: 'light', icon: 'sunny' },
  { label: 'Dark', value: 'dark', icon: 'moon' },
  { label: 'System', value: 'system', icon: 'phone-portrait' },
];

export default function SettingsScreen() {
  const { countryCode, setCountryCode, region, setRegion } = useEvents();
  const { colors, mode, preference, setPreference } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={styles.header}>Settings</Text>

        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map(opt => {
            const selected = preference === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.themeOption, selected && (mode === 'dark' ? styles.themeOptionSelectedDark : styles.themeOptionSelectedLight)]}
                onPress={() => setPreference(opt.value)}
              >
                <Ionicons name={opt.icon as any} size={18} color={selected ? colors.white : colors.textPrimary} />
                <Text style={[styles.themeOptionText, selected && { color: colors.white }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Holidays</Text>
        <Text style={styles.helperText}>
          Non-working days for your country will be highlighted on the calendar. Region code is only needed for
          countries with state-specific holidays (e.g. US state codes like US-CA).
        </Text>

        <View style={styles.countryGrid}>
          {SUPPORTED_COUNTRIES.map(c => (
            <Pressable
              key={c.code}
              style={[styles.countryChip, countryCode === c.code && styles.countryChipSelected]}
              onPress={() => setCountryCode(c.code)}
            >
              <Text style={[styles.countryText, countryCode === c.code && styles.countryTextSelected]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Region / state code (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. US-CA"
          placeholderTextColor={colors.textSecondary}
          value={region}
          onChangeText={setRegion}
          autoCapitalize="characters"
        />

        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { ...typography.screenTitle, color: colors.textPrimary, marginBottom: spacing.xl },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
    helperText: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
    themeRow: { flexDirection: 'row', gap: spacing.sm },
    themeOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
    },
    themeOptionSelectedLight: { backgroundColor: colors.surfaceDark, borderColor: 'transparent' },
    themeOptionSelectedDark: { backgroundColor: colors.accent, borderColor: 'transparent' },
    themeOptionText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    countryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    countryChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    countryChipSelected: { backgroundColor: colors.surfaceDark, borderColor: colors.surfaceDark },
    countryText: { fontSize: 13, color: colors.textPrimary },
    countryTextSelected: { color: colors.textOnDark },
    input: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, color: colors.textPrimary },
    aboutRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxl * 1.3, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
    aboutLabel: { fontSize: 14, color: colors.textSecondary },
    aboutValue: { fontSize: 14, color: colors.textPrimary },
  });
}
