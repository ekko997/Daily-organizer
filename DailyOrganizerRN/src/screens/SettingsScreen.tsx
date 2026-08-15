import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvents } from '../utils/EventsContext';
import { SUPPORTED_COUNTRIES } from '../services/holidayService';
import { searchCity, CitySearchResult } from '../services/weatherService';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme, ThemePreference } from '../utils/ThemeContext';

const THEME_OPTIONS: { label: string; value: ThemePreference; icon: string }[] = [
  { label: 'Light', value: 'light', icon: 'sunny' },
  { label: 'Dark', value: 'dark', icon: 'moon' },
  { label: 'System', value: 'system', icon: 'phone-portrait' },
];

export default function SettingsScreen() {
  const { countryCode, setCountryCode, region, setRegion, cityName, setLocation } = useEvents();
  const { colors, mode, preference, setPreference } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleCitySearch() {
    if (!cityQuery.trim()) return;
    setSearching(true);
    const results = await searchCity(cityQuery);
    setCityResults(results);
    setSearching(false);
  }

  function pickCity(result: CitySearchResult) {
    const label = result.admin1 ? `${result.name}, ${result.admin1}, ${result.country}` : `${result.name}, ${result.country}`;
    setLocation(label, result.latitude, result.longitude);
    setCityResults([]);
    setCityQuery('');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
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

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Weather location</Text>
        <Text style={styles.helperText}>
          Set your city to see a forecast for each day when scheduling. Weather is only available up to 16 days ahead.
        </Text>

        {cityName ? (
          <View style={styles.currentCityRow}>
            <Ionicons name="location" size={16} color={colors.accent} />
            <Text style={styles.currentCityText}>{cityName}</Text>
            <Pressable onPress={() => setCityQuery('')}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.citySearchRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Search for a city"
            placeholderTextColor={colors.textSecondary}
            value={cityQuery}
            onChangeText={setCityQuery}
            onSubmitEditing={handleCitySearch}
          />
          <Pressable style={styles.searchButton} onPress={handleCitySearch}>
            {searching ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="search" size={18} color={colors.white} />}
          </Pressable>
        </View>

        {cityResults.map((result, i) => (
          <Pressable key={i} style={styles.cityResultRow} onPress={() => pickCity(result)}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.cityResultText}>
              {result.name}{result.admin1 ? `, ${result.admin1}` : ''}, {result.country}
            </Text>
          </Pressable>
        ))}

        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
    currentCityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, marginBottom: spacing.sm },
    currentCityText: { flex: 1, fontSize: 14, color: colors.textPrimary },
    changeLink: { fontSize: 13, color: colors.accent, fontWeight: '600' },
    citySearchRow: { flexDirection: 'row', gap: spacing.sm },
    searchButton: { width: 44, borderRadius: radii.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    cityResultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    cityResultText: { fontSize: 14, color: colors.textPrimary },
  });
}
