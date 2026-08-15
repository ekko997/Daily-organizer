import React from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { useEvents } from '../utils/EventsContext';
import { SUPPORTED_COUNTRIES } from '../services/holidayService';
import { colors, spacing, radii, typography } from '../utils/theme';

export default function SettingsScreen() {
  const { countryCode, setCountryCode, region, setRegion } = useEvents();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={styles.header}>Settings</Text>

        <Text style={styles.sectionLabel}>Holidays</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { ...typography.screenTitle, color: colors.textPrimary, marginBottom: spacing.xl },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  helperText: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
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
