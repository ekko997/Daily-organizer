import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvents } from '../utils/EventsContext';
import { useAuth } from '../utils/AuthContext';
import { useFamily } from '../utils/FamilyContext';
import { SUPPORTED_COUNTRIES } from '../services/holidayService';
import { searchCity, CitySearchResult } from '../services/weatherService';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme, ThemePreference } from '../utils/ThemeContext';
import { capitalizeFirst } from '../utils/textUtils';
import { useToast } from '../utils/ToastContext';
import { haptics } from '../utils/haptics';

const THEME_OPTIONS: { label: string; value: ThemePreference; icon: string }[] = [
  { label: 'Light', value: 'light', icon: 'sunny' },
  { label: 'Dark', value: 'dark', icon: 'moon' },
  { label: 'System', value: 'system', icon: 'phone-portrait' },
];

// Countries where Nager.Date's holiday data actually varies by state/province.
// The region field is only useful (and shown) for these.
const COUNTRIES_WITH_REGIONS = new Set(['US', 'CA', 'AU']);

export default function SettingsScreen() {
  const { countryCode, setCountryCode, region, setRegion, cityName, setLocation } = useEvents();
  const { user, signOut } = useAuth();
  const { family, members, renameFamily, removeMember, leaveFamily } = useFamily();
  const { colors, mode, preference, setPreference } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [editingFamilyName, setEditingFamilyName] = useState(false);
  const [familyNameDraft, setFamilyNameDraft] = useState('');

  const selectedCountryName = SUPPORTED_COUNTRIES.find(c => c.code === countryCode)?.name || 'Select a country';

  async function handleSaveFamilyName() {
    if (familyNameDraft.trim()) await renameFamily(familyNameDraft.trim());
    setEditingFamilyName(false);
  }

  async function handleShareCode() {
    if (!family) return;
    await Share.share({ message: `Join our family calendar on Daily Organizer! Invite code: ${family.inviteCode}` });
  }

  function handleRemoveMember(uid: string, email: string) {
    Alert.alert(
      'Remove member?',
      `${email} will lose access to this family calendar. Their events on it will stay, but they won't be able to see or edit them anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            haptics.warning();
            await removeMember(uid);
            showToast({ message: `${email} removed from the family` });
          },
        },
      ]
    );
  }

  function handleLeaveFamily() {
    Alert.alert(
      'Leave this family?',
      "You'll lose access to the shared calendar. You can rejoin later with the invite code if someone shares it with you again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            haptics.warning();
            await leaveFamily();
            showToast({ message: 'You left the family' });
          },
        },
      ]
    );
  }

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

        <Text style={styles.sectionLabel}>Family</Text>
        <View style={styles.familyCard}>
          {editingFamilyName ? (
            <View style={styles.familyNameEditRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={familyNameDraft}
                onChangeText={text => setFamilyNameDraft(capitalizeFirst(text))}
                placeholder="Family name"
                placeholderTextColor={colors.textSecondary}
                autoFocus
              />
              <Pressable onPress={handleSaveFamilyName}><Text style={styles.saveLink}>Save</Text></Pressable>
            </View>
          ) : (
            <Pressable style={styles.familyNameRow} onPress={() => { setFamilyNameDraft(family?.name || ''); setEditingFamilyName(true); }}>
              <Text style={styles.familyNameText}>{family?.name || 'Family'}</Text>
              <Ionicons name="pencil" size={14} color={colors.textSecondary} />
            </Pressable>
          )}

          <View style={styles.inviteRow}>
            <View>
              <Text style={styles.inviteLabel}>Invite code</Text>
              <Text style={styles.inviteCode}>{family?.inviteCode}</Text>
            </View>
            <Pressable style={styles.shareButton} onPress={handleShareCode}>
              <Ionicons name="share-outline" size={16} color={colors.white} />
              <Text style={styles.shareButtonText}>Share</Text>
            </Pressable>
          </View>

          <Text style={styles.memberListLabel}>Members</Text>
          {members.map(m => (
            <View key={m.uid} style={styles.memberRow}>
              <Ionicons name="person-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.memberEmail} numberOfLines={1}>
                {m.email}{m.uid === user?.uid ? ' (you)' : ''}{m.uid === family?.createdBy ? ' · Creator' : ''}
              </Text>
              {family?.createdBy === user?.uid && m.uid !== user?.uid && (
                <Pressable onPress={() => handleRemoveMember(m.uid, m.email)}>
                  <Ionicons name="close-circle" size={18} color={colors.holiday} />
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <Pressable style={styles.leaveButton} onPress={handleLeaveFamily}>
          <Text style={styles.signOutText}>Leave this family</Text>
        </Pressable>

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out{user?.email ? ` (${user.email})` : ''}</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Appearance</Text>
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

        <View style={styles.dropdownWrapper}>
          <Pressable style={styles.selectorButton} onPress={() => setCountryDropdownOpen(!countryDropdownOpen)}>
            <Text style={styles.selectorText}>{selectedCountryName}</Text>
            <Ionicons name={countryDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
          </Pressable>

          {countryDropdownOpen && (
            <View style={styles.dropdown}>
              <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                {SUPPORTED_COUNTRIES.map((c, i) => (
                  <Pressable
                    key={c.code}
                    style={[
                      styles.dropdownRow,
                      i < SUPPORTED_COUNTRIES.length - 1 && styles.cityResultDivider,
                      countryCode === c.code && styles.dropdownRowSelected,
                    ]}
                    onPress={() => { setCountryCode(c.code); setCountryDropdownOpen(false); }}
                  >
                    <Text style={[styles.dropdownRowText, countryCode === c.code && { color: colors.accent, fontWeight: '600' }]}>
                      {c.name}
                    </Text>
                    {countryCode === c.code && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {COUNTRIES_WITH_REGIONS.has(countryCode) && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Region / state code (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. US-CA"
              placeholderTextColor={colors.textSecondary}
              value={region}
              onChangeText={setRegion}
              autoCapitalize="characters"
            />
          </>
        )}

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

        <View style={styles.citySearchWrapper}>
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

          {cityResults.length > 0 && (
            <View style={styles.dropdown}>
              {cityResults.map((result, i) => (
                <Pressable
                  key={i}
                  style={[styles.cityResultRow, i < cityResults.length - 1 && styles.cityResultDivider]}
                  onPress={() => pickCity(result)}
                >
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.cityResultText}>
                    {result.name}{result.admin1 ? `, ${result.admin1}` : ''}, {result.country}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

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
    dropdownWrapper: { position: 'relative', zIndex: 20, marginBottom: spacing.sm },
    selectorButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.sm,
      padding: spacing.md,
    },
    selectorText: { fontSize: 15, color: colors.textPrimary },
    dropdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    dropdownRowSelected: { backgroundColor: colors.surface },
    dropdownRowText: { fontSize: 14, color: colors.textPrimary },
    input: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, color: colors.textPrimary },
    aboutRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxl * 1.3, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
    aboutLabel: { fontSize: 14, color: colors.textSecondary },
    aboutValue: { fontSize: 14, color: colors.textPrimary },
    currentCityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, marginBottom: spacing.sm },
    currentCityText: { flex: 1, fontSize: 14, color: colors.textPrimary },
    changeLink: { fontSize: 13, color: colors.accent, fontWeight: '600' },
    citySearchWrapper: { position: 'relative', zIndex: 10 },
    citySearchRow: { flexDirection: 'row', gap: spacing.sm },
    searchButton: { width: 44, borderRadius: radii.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    dropdown: {
      position: 'absolute',
      top: 54,
      left: 0,
      right: 0,
      backgroundColor: colors.background,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
      paddingVertical: spacing.xs,
    },
    cityResultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    cityResultDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    cityResultText: { fontSize: 14, color: colors.textPrimary },
    familyCard: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm },
    familyNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    familyNameText: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    familyNameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    saveLink: { color: colors.accent, fontWeight: '700', fontSize: 14 },
    inviteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    inviteLabel: { fontSize: 12, color: colors.textSecondary },
    inviteCode: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, letterSpacing: 2 },
    shareButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    shareButtonText: { color: colors.white, fontSize: 13, fontWeight: '600' },
    memberCount: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.md },
    memberListLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
    memberEmail: { flex: 1, fontSize: 13, color: colors.textPrimary },
    leaveButton: { alignItems: 'center', padding: spacing.sm, marginTop: spacing.sm },
    signOutButton: { alignItems: 'center', padding: spacing.sm },
    signOutText: { color: colors.holiday, fontSize: 13, fontWeight: '600' },
  });
}
