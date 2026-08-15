import React from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { useEvents } from '../utils/EventsContext';
import { SUPPORTED_COUNTRIES } from '../services/holidayService';

export default function SettingsScreen() {
  const { countryCode, setCountryCode, region, setRegion } = useEvents();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
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

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Region / state code (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. US-CA"
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: '600', marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#8C8C90', marginBottom: 6 },
  helperText: { fontSize: 13, color: '#8C8C90', marginBottom: 12, lineHeight: 18 },
  countryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countryChip: { borderWidth: 1, borderColor: '#EDEDEF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  countryChipSelected: { backgroundColor: '#111113', borderColor: '#111113' },
  countryText: { fontSize: 13, color: '#111113' },
  countryTextSelected: { color: '#fff' },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 12, fontSize: 15 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#EDEDEF' },
  aboutLabel: { fontSize: 14, color: '#8C8C90' },
  aboutValue: { fontSize: 14 },
});
