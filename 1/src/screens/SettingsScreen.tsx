import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Share, Alert, Switch, Modal } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES, setAppLanguage } from '../i18n';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { setDisplayName as setMemberDisplayName, getMemberProfiles } from '../services/familyService';
import { Ionicons } from '@expo/vector-icons';
import { useEvents } from '../utils/EventsContext';
import { useAuth } from '../utils/AuthContext';
import { useFamily } from '../utils/FamilyContext';
import { SUPPORTED_COUNTRIES } from '../services/holidayService';
import { searchCity, CitySearchResult } from '../services/weatherService';
import { isBiometricAvailable } from '../services/biometricService';
import { loadSettings, saveSettings } from '../services/settingsStorageService';
import { parseIcsEvents } from '../services/icsImportService';
import { upsertCloudEvent, CloudEvent } from '../services/cloudEventService';
import { spacing, radii, typography, cardShadow, ThemeColors } from '../utils/theme';
import { memberDisplayName } from '../utils/memberColor';
import { useTheme, ThemePreference } from '../utils/ThemeContext';
import { capitalizeFirst } from '../utils/textUtils';
import { useToast } from '../utils/ToastContext';
import { haptics } from '../utils/haptics';
import { usePendingInvite } from '../utils/PendingInviteContext';
import YearRecapModal from './YearRecapModal';
import FamilySetupScreen from './FamilySetupScreen';
import HolidayListModal from './HolidayListModal';
import ScreenTransition from '../components/ScreenTransition';

const THEME_OPTIONS: { label: string; value: ThemePreference; icon: string }[] = [
  { label: 'Light', value: 'light', icon: 'sunny' },
  { label: 'Dark', value: 'dark', icon: 'moon' },
  { label: 'System', value: 'system', icon: 'phone-portrait' },
];

// Countries where Nager.Date's holiday data actually varies by state/province.
// The region field is only useful (and shown) for these.
const COUNTRIES_WITH_REGIONS = new Set(['US', 'CA', 'AU']);

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { countryCode, setCountryCode, region, setRegion, cityName, setLocation, events, restrictToOwnEvents, setRestrictToOwnEvents } = useEvents();
  const { user, signOut, deleteAccount } = useAuth();
  const { family, members, renameFamily, removeMember, leaveFamily, loadError, retryLoad } = useFamily();
  const { pendingInviteCode, clearPendingInviteCode } = usePendingInvite();
  const { colors, mode, preference, setPreference } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [editingFamilyName, setEditingFamilyName] = useState(false);
  const [familyNameDraft, setFamilyNameDraft] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(true);
  const [vacationAllowance, setVacationAllowance] = useState(0);
  const [vacationUsed, setVacationUsed] = useState(0);
  const [sickAllowance, setSickAllowance] = useState(0);
  const [sickUsed, setSickUsed] = useState(0);
  const [editingAllowances, setEditingAllowances] = useState(false);
  const [recapVisible, setRecapVisible] = useState(false);
  const [familySetupVisible, setFamilySetupVisible] = useState(false);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState(22);
  const [quietHoursEnd, setQuietHoursEnd] = useState(7);
  const [holidayListVisible, setHolidayListVisible] = useState(false);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [savedDisplayName, setSavedDisplayName] = useState('');
  const [displayNameDraft, setDisplayNameDraft] = useState('');

  // Fetched independently of the family member list, so this works even
  // for solo users who haven't joined a family yet.
  useEffect(() => {
    if (!user) return;
    getMemberProfiles([user.uid]).then(profiles => {
      const current = profiles[0]?.displayName || '';
      setSavedDisplayName(current);
      setDisplayNameDraft(current);
    }).catch(() => {});
  }, [user?.uid]);

  async function handleSaveDisplayName() {
    if (!user || !displayNameDraft.trim()) return;
    try {
      await setMemberDisplayName(user.uid, displayNameDraft.trim());
      setSavedDisplayName(displayNameDraft.trim());
      haptics.light();
      showToast({ message: 'Name updated' });
    } catch (err: any) {
      showToast({ message: `Couldn't save: ${err?.message || 'unknown error'}` });
    }
  }

  async function handleChangePassword() {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast({ message: `Password reset link sent to ${user.email}`, duration: 4000 });
    } catch (err: any) {
      showToast({ message: `Couldn't send reset email: ${err?.message || 'unknown error'}` });
    }
  }
  const [whatsNewVisible, setWhatsNewVisible] = useState(false);

  function formatHour(hour: number): string {
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h}${hour < 12 ? 'am' : 'pm'}`;
  }

  function cycleQuietHour(which: 'start' | 'end') {
    haptics.light();
    if (which === 'start') {
      const next = (quietHoursStart + 1) % 24;
      setQuietHoursStart(next);
      saveSettings({ quietHoursStart: next });
    } else {
      const next = (quietHoursEnd + 1) % 24;
      setQuietHoursEnd(next);
      saveSettings({ quietHoursEnd: next });
    }
  }

  function handleToggleQuietHours(value: boolean) {
    setQuietHoursEnabled(value);
    saveSettings({ quietHoursEnabled: value });
  }

  // If someone tapped a shared invite link, jump straight into the join flow.
  useEffect(() => {
    if (pendingInviteCode && !family) {
      setFamilySetupVisible(true);
    }
  }, [pendingInviteCode, family]);

  function handleCloseFamilySetup() {
    setFamilySetupVisible(false);
    clearPendingInviteCode();
  }
  const [vacationAllowanceDraft, setVacationAllowanceDraft] = useState('0');
  const [sickAllowanceDraft, setSickAllowanceDraft] = useState('0');

  useEffect(() => {
    isBiometricAvailable().then(setBiometricSupported);
    loadSettings().then(saved => {
      setBiometricEnabled(!!saved.biometricLockEnabled);
      const currentYear = new Date().getFullYear();
      if (saved.timeOffYear && saved.timeOffYear !== currentYear) {
        // New year — reset usage but keep the allowance amounts.
        setVacationAllowance(saved.vacationAllowance ?? 0);
        setSickAllowance(saved.sickAllowance ?? 0);
        setVacationUsed(0);
        setSickUsed(0);
        saveSettings({ vacationUsed: 0, sickUsed: 0, timeOffYear: currentYear });
      } else {
        setVacationAllowance(saved.vacationAllowance ?? 0);
        setVacationUsed(saved.vacationUsed ?? 0);
        setSickAllowance(saved.sickAllowance ?? 0);
        setSickUsed(saved.sickUsed ?? 0);
        if (!saved.timeOffYear) saveSettings({ timeOffYear: currentYear });
      }
      setQuietHoursEnabled(!!saved.quietHoursEnabled);
      if (typeof saved.quietHoursStart === 'number') setQuietHoursStart(saved.quietHoursStart);
      if (typeof saved.quietHoursEnd === 'number') setQuietHoursEnd(saved.quietHoursEnd);
    });
  }, []);

  async function adjustTimeOff(type: 'vacation' | 'sick', delta: number) {
    haptics.light();
    if (type === 'vacation') {
      const next = Math.max(0, vacationUsed + delta);
      setVacationUsed(next);
      await saveSettings({ vacationUsed: next });
    } else {
      const next = Math.max(0, sickUsed + delta);
      setSickUsed(next);
      await saveSettings({ sickUsed: next });
    }
  }

  async function handleSaveAllowances() {
    const vac = Math.max(0, parseInt(vacationAllowanceDraft, 10) || 0);
    const sick = Math.max(0, parseInt(sickAllowanceDraft, 10) || 0);
    setVacationAllowance(vac);
    setSickAllowance(sick);
    await saveSettings({ vacationAllowance: vac, sickAllowance: sick });
    setEditingAllowances(false);
  }

  async function handleToggleBiometricLock(value: boolean) {
    if (value && !biometricSupported) {
      showToast({ message: 'No Face ID / Touch ID set up on this device' });
      return;
    }
    setBiometricEnabled(value);
    await saveSettings({ biometricLockEnabled: value });
  }

  async function handleExportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: user?.email,
      events,
    };
    try {
      await Share.share({
        title: 'Steady Days data export',
        message: JSON.stringify(payload, null, 2),
      });
    } catch {
      showToast({ message: 'Could not export data' });
    }
  }

  async function handleExportIcs() {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Steady Days//EN'];
    for (const event of events) {
      const dt = new Date(event.date);
      const stamp = dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${event.id}@dailyorganizer`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${stamp}`,
        `SUMMARY:${event.title.replace(/\n/g, ' ')}`,
        event.notes ? `DESCRIPTION:${event.notes.replace(/\n/g, ' ')}` : '',
        event.location ? `LOCATION:${event.location.replace(/\n/g, ' ')}` : '',
        'END:VEVENT'
      );
    }
    lines.push('END:VCALENDAR');
    const icsContent = lines.filter(Boolean).join('\r\n');
    try {
      await Share.share({
        title: 'Steady Days calendar (.ics)',
        message: icsContent,
      });
      showToast({ message: 'Save the shared text as a .ics file to import elsewhere', duration: 4000 });
    } catch {
      showToast({ message: 'Could not export calendar' });
    }
  }

  async function handleImportIcs() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/calendar', '*/*'] });
      if (result.canceled || !result.assets?.[0]) return;

      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const parsed = parseIcsEvents(content);

      if (parsed.length === 0) {
        showToast({ message: 'No events found in that file' });
        return;
      }

      if (!user) return;
      let imported = 0;
      for (const item of parsed) {
        const event: CloudEvent = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${imported}`,
          title: item.title,
          notes: item.notes,
          location: item.location || undefined,
          date: item.date,
          isAllDay: false,
          category: 'personal',
          recurrence: 'none',
          reminderMinutesBefore: -1,
          createdAt: new Date().toISOString(),
          ownerId: user.uid,
          scope: 'personal',
          familyId: null,
          lastModifiedBy: user.uid,
        };
        await upsertCloudEvent(event);
        imported++;
      }
      haptics.success();
      showToast({ message: `Imported ${imported} event${imported === 1 ? '' : 's'}`, duration: 4000 });
    } catch (err: any) {
      showToast({ message: `Import failed: ${err?.message || 'unknown error'}` });
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      "This permanently deletes your sign-in and removes your access to any shared family calendars. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (err: any) {
              if (err?.code === 'auth/requires-recent-login') {
                showToast({ message: 'For security, please sign out and back in, then try deleting again right away.', duration: 5000 });
              } else {
                showToast({ message: `Could not delete account: ${err?.message || 'unknown error'}` });
              }
            }
          },
        },
      ]
    );
  }

  const selectedCountryName = SUPPORTED_COUNTRIES.find(c => c.code === countryCode)?.name || 'Select a country';

  async function handleSaveFamilyName() {
    if (familyNameDraft.trim()) await renameFamily(familyNameDraft.trim());
    setEditingFamilyName(false);
  }

  async function handleShareCode() {
    if (!family) return;
    const link = `dailyorganizer://join?code=${family.inviteCode}`;
    await Share.share({
      message: `Join our family calendar on Steady Days!\n\nInvite code: ${family.inviteCode}\n\nOr tap this link if you already have the app installed: ${link}`,
    });
  }

  async function handleCopyCode() {
    if (!family) return;
    await Clipboard.setStringAsync(family.inviteCode);
    haptics.light();
    showToast({ message: 'Invite code copied' });
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
      <ScreenTransition>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Settings</Text>

        <Text style={styles.sectionLabel}>Family</Text>
        {family ? (
          <>
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
                <Pressable style={styles.familyNameRow} accessibilityLabel="Edit family name" accessibilityRole="button" onPress={() => { setFamilyNameDraft(family?.name || ''); setEditingFamilyName(true); }}>
                  <Text style={styles.familyNameText}>{family?.name || 'Family'}</Text>
                  <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                </Pressable>
              )}

              <View style={styles.inviteRow}>
                <Pressable onPress={handleCopyCode} accessibilityLabel="Tap to copy invite code" accessibilityRole="button">
                  <Text style={styles.inviteLabel}>Invite code (tap to copy)</Text>
                  <Text style={styles.inviteCode} maxFontSizeMultiplier={1.4}>{family?.inviteCode}</Text>
                </Pressable>
                <Pressable style={styles.shareButton} accessibilityLabel="Share invite code" accessibilityRole="button" onPress={handleShareCode}>
                  <Ionicons name="share-outline" size={16} color={colors.white} />
                  <Text style={styles.shareButtonText}>Share</Text>
                </Pressable>
              </View>

              <Text style={styles.memberListLabel}>Members</Text>
              {members.map(m => (
                <View key={m.uid} style={styles.memberRow}>
                  <Ionicons name="person-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.memberEmail} numberOfLines={1}>
                    {memberDisplayName(m)}{m.uid === user?.uid ? ' (you)' : ''}{m.uid === family?.createdBy ? ' · Creator' : ''}
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
          </>
        ) : (
          <View style={styles.familyCard}>
            {loadError ? (
              <>
                <View style={styles.lockRow}>
                  <Ionicons name="warning-outline" size={18} color={colors.holiday} />
                  <Text style={[styles.helperText, { flex: 1, color: colors.holiday }]}>
                    Couldn't check your family status: {loadError}
                  </Text>
                </View>
                <Pressable style={styles.dataButton} onPress={() => { haptics.light(); retryLoad(); }}>
                  <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
                  <Text style={styles.dataButtonText}>Try again</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.helperText}>
                  You're using Steady Days solo right now. Set up family sharing anytime to add a shared calendar
                  you and others can see and edit together.
                </Text>
                <Pressable style={styles.dataButton} onPress={() => setFamilySetupVisible(true)}>
                  <Ionicons name="people-outline" size={16} color={colors.textPrimary} />
                  <Text style={styles.dataButtonText}>Set up family sharing</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Account</Text>
        <View style={styles.familyCard}>
          <Text style={styles.lockTitle}>Your name</Text>
          <Text style={styles.helperText}>Shown to family members instead of your email.</Text>
          <View style={styles.clearableInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginTop: spacing.sm, marginBottom: 0 }]}
              placeholder="Your name"
              placeholderTextColor={colors.textSecondary}
              value={displayNameDraft}
              onChangeText={setDisplayNameDraft}
              autoCapitalize="words"
            />
          </View>
          {displayNameDraft.trim() !== savedDisplayName && (
            <Pressable style={{ marginTop: spacing.sm }} onPress={handleSaveDisplayName}>
              <Text style={styles.saveLink}>Save name</Text>
            </Pressable>
          )}

          <View style={[styles.lockRow, { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Email</Text>
              <Text style={styles.helperText}>{user?.email}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.dataButton, { marginTop: spacing.md }, pressed && { opacity: 0.6 }]}
            onPress={handleChangePassword}
            accessibilityLabel="Change password"
            accessibilityRole="button"
          >
            <Ionicons name="key-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.dataButtonText}>Change password</Text>
          </Pressable>
        </View>

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

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>{t('settings_language')}</Text>
        <View style={{ position: 'relative', zIndex: 10 }}>
          <Pressable style={styles.langDropdownButton} onPress={() => setLanguageDropdownOpen(!languageDropdownOpen)}>
            <Text style={styles.dataButtonText}>{SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)?.label ?? 'English'}</Text>
            <Ionicons name={languageDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
          </Pressable>
          {languageDropdownOpen && (
            <View style={styles.langDropdown}>
              {SUPPORTED_LANGUAGES.map((lang, i) => {
                const selected = i18n.language === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    style={[styles.langDropdownRow, i > 0 && styles.langDropdownDivider]}
                    onPress={() => { haptics.light(); setAppLanguage(lang.code); setLanguageDropdownOpen(false); }}
                  >
                    <Text style={[styles.langDropdownText, selected && { color: colors.accent, fontWeight: '700' }]}>{lang.label}</Text>
                    {selected && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Privacy</Text>
        <View style={styles.familyCard}>
          <View style={styles.lockRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Require Face ID / Touch ID</Text>
              <Text style={styles.helperText}>Ask for biometric unlock every time you open the app.</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometricLock}
              trackColor={{ true: colors.accent }}
              accessibilityLabel="Require Face ID or Touch ID to open the app"
            />
          </View>

          {family && (
            <View style={[styles.lockRow, { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lockTitle}>Kid-safe mode</Text>
                <Text style={styles.helperText} maxFontSizeMultiplier={1.4}>
                  Only show family events assigned to you. Anyone can turn this back off — it's for reducing clutter,
                  not a security lock.
                </Text>
              </View>
              <Switch
                value={restrictToOwnEvents}
                onValueChange={setRestrictToOwnEvents}
                trackColor={{ true: colors.accent }}
                accessibilityLabel="Only show my own family events"
              />
            </View>
          )}

          <View style={[styles.lockRow, { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Quiet hours</Text>
              <Text style={styles.helperText} maxFontSizeMultiplier={1.4}>
                Reminders during this window are delayed until it ends, not lost.
              </Text>
            </View>
            <Switch
              value={quietHoursEnabled}
              onValueChange={handleToggleQuietHours}
              trackColor={{ true: colors.accent }}
              accessibilityLabel="Enable quiet hours"
            />
          </View>
          {quietHoursEnabled && (
            <View style={styles.quietHoursRow}>
              <Pressable style={styles.quietHoursButton} onPress={() => cycleQuietHour('start')}>
                <Text style={styles.quietHoursLabel}>From</Text>
                <Text style={styles.quietHoursValue} maxFontSizeMultiplier={1.3}>{formatHour(quietHoursStart)}</Text>
              </Pressable>
              <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
              <Pressable style={styles.quietHoursButton} onPress={() => cycleQuietHour('end')}>
                <Text style={styles.quietHoursLabel}>Until</Text>
                <Text style={styles.quietHoursValue} maxFontSizeMultiplier={1.3}>{formatHour(quietHoursEnd)}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Time Off</Text>
        <View style={styles.familyCard}>
          <View style={styles.timeOffRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Vacation days</Text>
              <Text style={styles.timeOffCount} maxFontSizeMultiplier={1.3}>{Math.max(0, vacationAllowance - vacationUsed)} of {vacationAllowance} left</Text>
            </View>
            <Pressable style={styles.timeOffButton} onPress={() => adjustTimeOff('vacation', -1)}>
              <Ionicons name="remove" size={16} color={colors.textPrimary} />
            </Pressable>
            <Pressable style={styles.timeOffButton} onPress={() => adjustTimeOff('vacation', 1)}>
              <Ionicons name="add" size={16} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={[styles.timeOffRow, { marginTop: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Sick days</Text>
              <Text style={styles.timeOffCount} maxFontSizeMultiplier={1.3}>{Math.max(0, sickAllowance - sickUsed)} of {sickAllowance} left</Text>
            </View>
            <Pressable style={styles.timeOffButton} onPress={() => adjustTimeOff('sick', -1)}>
              <Ionicons name="remove" size={16} color={colors.textPrimary} />
            </Pressable>
            <Pressable style={styles.timeOffButton} onPress={() => adjustTimeOff('sick', 1)}>
              <Ionicons name="add" size={16} color={colors.textPrimary} />
            </Pressable>
          </View>

          {editingAllowances ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <View style={styles.allowanceInputRow}>
                <Text style={styles.helperText}>Vacation days/year</Text>
                <TextInput
                  style={styles.allowanceInput}
                  keyboardType="number-pad"
                  value={vacationAllowanceDraft}
                  onChangeText={setVacationAllowanceDraft}
                />
              </View>
              <View style={styles.allowanceInputRow}>
                <Text style={styles.helperText}>Sick days/year</Text>
                <TextInput
                  style={styles.allowanceInput}
                  keyboardType="number-pad"
                  value={sickAllowanceDraft}
                  onChangeText={setSickAllowanceDraft}
                />
              </View>
              <Pressable onPress={handleSaveAllowances}><Text style={styles.saveLink}>Save allowances</Text></Pressable>
            </View>
          ) : (
            <Pressable
              style={{ marginTop: spacing.md }}
              onPress={() => {
                setVacationAllowanceDraft(String(vacationAllowance));
                setSickAllowanceDraft(String(sickAllowance));
                setEditingAllowances(true);
              }}
            >
              <Text style={styles.saveLink}>Edit allowances</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Holidays</Text>
        <Text style={styles.helperText}>
          Non-working days for your country will be highlighted on the calendar. Region code is only needed for
          countries with state-specific holidays (e.g. US state codes like US-CA).
        </Text>
        <Pressable onPress={() => setHolidayListVisible(true)} style={{ marginBottom: spacing.md }}>
          <Text style={styles.saveLink}>View all {new Date().getFullYear()} holidays</Text>
        </Pressable>

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
            <View style={styles.clearableInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="e.g. US-CA"
                placeholderTextColor={colors.textSecondary}
                value={region}
                onChangeText={setRegion}
                autoCapitalize="characters"
              />
              {region.length > 0 && (
                <Pressable onPress={() => setRegion('')} accessibilityLabel="Clear region" accessibilityRole="button" style={styles.clearButton}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
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
        <Pressable onPress={() => setWhatsNewVisible(true)} style={{ marginTop: spacing.sm }}>
          <Text style={styles.saveLink}>What's new</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Data</Text>
        <Pressable style={({ pressed }) => [styles.dataButton, pressed && { opacity: 0.6 }]} onPress={() => { haptics.light(); setRecapVisible(true); }} accessibilityLabel="View year in review" accessibilityRole="button">
          <Ionicons name="sparkles-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.dataButtonText}>Year in Review</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.dataButton, pressed && { opacity: 0.6 }]} onPress={handleExportData} accessibilityLabel="Export my data as JSON" accessibilityRole="button">
          <Ionicons name="download-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.dataButtonText}>Export my data (JSON)</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.dataButton, pressed && { opacity: 0.6 }]} onPress={handleExportIcs} accessibilityLabel="Export calendar as an ics file" accessibilityRole="button">
          <Ionicons name="calendar-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.dataButtonText}>Export calendar (.ics)</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.dataButton, pressed && { opacity: 0.6 }]} onPress={handleImportIcs} accessibilityLabel="Import a calendar file" accessibilityRole="button">
          <Ionicons name="cloud-upload-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.dataButtonText}>Import calendar (.ics)</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.deleteAccountButton, pressed && { opacity: 0.6 }]} onPress={handleDeleteAccount} accessibilityLabel="Delete my account" accessibilityRole="button">
          <Text style={styles.signOutText}>Delete my account</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
      </ScreenTransition>

      <YearRecapModal visible={recapVisible} onClose={() => setRecapVisible(false)} events={events} />
      <FamilySetupScreen
        visible={familySetupVisible}
        onClose={handleCloseFamilySetup}
        initialInviteCode={pendingInviteCode}
      />
      <HolidayListModal
        visible={holidayListVisible}
        onClose={() => setHolidayListVisible(false)}
        countryCode={countryCode}
        region={region}
      />
      <Modal visible={whatsNewVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setWhatsNewVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl }}>
            <View style={{ width: 60 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>What's New</Text>
            <Pressable style={{ width: 60, alignItems: 'flex-end' }} onPress={() => setWhatsNewVisible(false)}>
              <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            {WHATS_NEW.map((entry, i) => (
              <View key={i} style={{ marginBottom: spacing.lg }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent, marginBottom: spacing.xs }}>{entry.title}</Text>
                {entry.items.map((item, j) => (
                  <Text key={j} style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>• {item}</Text>
                ))}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const WHATS_NEW = [
  {
    title: 'This update',
    items: [
      'Week view alongside Month on the calendar',
      'Countdown, birthday ages, and anniversary years shown automatically',
      'Duplicate and share events directly',
      'Quiet hours for reminders',
      'Full holiday list, and a "What\'s New" screen (you\'re looking at it)',
    ],
  },
  {
    title: 'Family sharing',
    items: [
      'Shared calendar, to-do list, invite links, and per-person colors',
      'Kid-safe mode to reduce clutter',
    ],
  },
];

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
    clearableInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    clearButton: { padding: spacing.xs },
    aboutRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxl * 1.3, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
    dataButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, marginBottom: spacing.sm },
    langDropdownButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    langDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, backgroundColor: colors.surface, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, ...cardShadow },
    langDropdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
    langDropdownDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    langDropdownText: { fontSize: 14, color: colors.textPrimary },
    dataButtonText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    deleteAccountButton: { alignItems: 'center', padding: spacing.sm, marginTop: spacing.xs },
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
    familyCard: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, ...cardShadow },
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
    lockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    quietHoursRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    quietHoursButton: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.sm + 2, alignItems: 'center' },
    quietHoursLabel: { fontSize: 10, color: colors.textSecondary, marginBottom: 2 },
    quietHoursValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    timeOffRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    timeOffCount: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    timeOffButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    allowanceInputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    allowanceInput: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.sm, width: 60, textAlign: 'center', fontSize: 14, color: colors.textPrimary },
    lockTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
    signOutButton: { alignItems: 'center', padding: spacing.sm },
    signOutText: { color: colors.holiday, fontSize: 13, fontWeight: '600' },
  });
}
