import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, ScrollView, Switch, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { EventCategory, RecurrenceRule, CATEGORY_STYLES, REMINDER_OPTIONS, defaultsToYearlyRecurrence } from '../models/Event';
import { useEvents } from '../utils/EventsContext';
import { useAuth } from '../utils/AuthContext';
import { useFamily } from '../utils/FamilyContext';
import { CloudEvent, upsertCloudEvent, deleteCloudEvent } from '../services/cloudEventService';
import { scheduleReminder, cancelReminder } from '../services/notificationService';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { capitalizeFirst } from '../utils/textUtils';
import { useToast } from '../utils/ToastContext';
import { haptics } from '../utils/haptics';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialDate: Date;
  editingEventId: string | null;
  // The specific occurrence date the user tapped (only meaningful for a
  // recurring event) — lets "delete this occurrence only" know which date
  // to exclude, without affecting the rest of the series.
  occurrenceDate?: Date;
}

export default function AddEditEventModal({ visible, onClose, initialDate, editingEventId, occurrenceDate }: Props) {
  const { events, activeScope } = useEvents();
  const { user } = useAuth();
  const { family } = useFamily();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const editingEvent = events.find(e => e.id === editingEventId) || null;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [date, setDate] = useState(initialDate);
  const [isAllDay, setIsAllDay] = useState(false);
  const [category, setCategory] = useState<EventCategory>('personal');
  const [recurrence, setRecurrence] = useState<RecurrenceRule>('none');
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [selectedScope, setSelectedScope] = useState<'personal' | 'family'>('personal');
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [deleteChoiceOpen, setDeleteChoiceOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editingEvent) {
        setTitle(editingEvent.title);
        setNotes(editingEvent.notes);
        setLocation(editingEvent.location || '');
        setMeetingLink(editingEvent.meetingLink || '');
        setDate(new Date(editingEvent.date));
        setIsAllDay(editingEvent.isAllDay);
        setCategory(editingEvent.category);
        setRecurrence(editingEvent.recurrence);
        setReminderMinutes(editingEvent.reminderMinutesBefore);
      } else {
        setTitle('');
        setNotes('');
        setLocation('');
        setMeetingLink('');
        setDate(initialDate);
        setIsAllDay(false);
        setCategory('personal');
        setRecurrence('none');
        setReminderMinutes(30);
        setSelectedScope(activeScope);
      }
      setScopeDropdownOpen(false);
      setDeleteChoiceOpen(false);
    }
  }, [visible, editingEventId]);

  function pickCategory(cat: EventCategory) {
    haptics.light();
    setCategory(cat);
    if (defaultsToYearlyRecurrence(cat)) setRecurrence('yearly');
  }

  async function handleSave() {
    if (!title.trim() || !user) return;
    // Editing keeps the event's original scope/owner; new events use whichever
    // calendar (Personal / Family) was picked in this form.
    const scope = editingEvent?.scope ?? selectedScope;
    const event: CloudEvent = {
      id: editingEvent?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      notes,
      location: location.trim() || undefined,
      meetingLink: meetingLink.trim() || undefined,
      date: date.toISOString(),
      isAllDay,
      category,
      recurrence,
      reminderMinutesBefore: reminderMinutes,
      createdAt: editingEvent?.createdAt ?? new Date().toISOString(),
      ownerId: editingEvent?.ownerId ?? user.uid,
      scope,
      familyId: scope === 'family' ? (family?.id ?? null) : null,
      excludedDates: editingEvent?.excludedDates,
    };
    await upsertCloudEvent(event);
    await scheduleReminder(event);
    haptics.success();
    showToast({ message: editingEvent ? 'Event updated' : 'Event added' });
    onClose();
  }

  function handleDeletePress() {
    if (!editingEvent) return;
    // Only offer the "this occurrence only" choice when we actually know
    // which occurrence was tapped, and it's a repeating event.
    if (editingEvent.recurrence !== 'none' && occurrenceDate) {
      setDeleteChoiceOpen(true);
    } else {
      handleDeleteSeries();
    }
  }

  async function handleDeleteSeries() {
    if (!editingEvent) return;
    await cancelReminder(editingEvent.id);
    await deleteCloudEvent(editingEvent.id);
    haptics.warning();
    showToast({ message: 'Event series deleted' });
    onClose();
  }

  async function handleDeleteThisOccurrence() {
    if (!editingEvent || !occurrenceDate) return;
    const key = format(occurrenceDate, 'yyyy-MM-dd');
    const updated: CloudEvent = {
      ...editingEvent,
      excludedDates: [...(editingEvent.excludedDates || []), key],
    };
    await upsertCloudEvent(updated);
    haptics.warning();
    showToast({ message: 'This occurrence removed' });
    onClose();
  }

  function openLocation() {
    if (!location.trim()) return;
    Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(location.trim())}`);
  }

  function openMeetingLink() {
    if (!meetingLink.trim()) return;
    const url = meetingLink.trim().startsWith('http') ? meetingLink.trim() : `https://${meetingLink.trim()}`;
    Linking.openURL(url);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ padding: spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.headerRow}>
          <Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable>
          <Text style={styles.title}>{editingEvent ? 'Edit Event' : 'New Event'}</Text>
          <Pressable onPress={handleSave}><Text style={styles.save}>Save</Text></Pressable>
        </View>

        {!editingEvent && (
          <View style={styles.scopeWrapper}>
            <Text style={styles.sectionLabel}>Adding to</Text>
            <Pressable style={styles.scopeButton} onPress={() => setScopeDropdownOpen(!scopeDropdownOpen)}>
              <Ionicons name={selectedScope === 'family' ? 'people' : 'person'} size={16} color={colors.accent} />
              <Text style={styles.scopeButtonText}>{selectedScope === 'family' ? (family?.name || 'Family') : 'Personal'}</Text>
              <Ionicons name={scopeDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
            </Pressable>

            {scopeDropdownOpen && (
              <View style={styles.scopeDropdown}>
                <Pressable
                  style={[styles.scopeDropdownRow, selectedScope === 'personal' && styles.scopeDropdownRowSelected]}
                  onPress={() => { setSelectedScope('personal'); setScopeDropdownOpen(false); }}
                >
                  <Ionicons name="person" size={16} color={colors.textSecondary} />
                  <Text style={styles.scopeDropdownText}>Personal</Text>
                </Pressable>
                <Pressable
                  style={[styles.scopeDropdownRow, styles.scopeDropdownDivider, selectedScope === 'family' && styles.scopeDropdownRowSelected]}
                  onPress={() => { setSelectedScope('family'); setScopeDropdownOpen(false); }}
                >
                  <Ionicons name="people" size={16} color={colors.textSecondary} />
                  <Text style={styles.scopeDropdownText}>{family?.name || 'Family'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Title"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={text => setTitle(capitalizeFirst(text))}
        />
        <TextInput
          style={[styles.input, { height: 70 }]}
          placeholder="Notes"
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <View style={styles.inlineFieldRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Location"
            placeholderTextColor={colors.textSecondary}
            value={location}
            onChangeText={setLocation}
          />
          {location.trim().length > 0 && (
            <Pressable style={styles.inlineFieldButton} onPress={openLocation}>
              <Ionicons name="navigate" size={18} color={colors.accent} />
            </Pressable>
          )}
        </View>

        <View style={[styles.inlineFieldRow, { marginTop: spacing.md }]}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Meeting link (Zoom, Teams...)"
            placeholderTextColor={colors.textSecondary}
            value={meetingLink}
            onChangeText={setMeetingLink}
            autoCapitalize="none"
            keyboardType="url"
          />
          {meetingLink.trim().length > 0 && (
            <Pressable style={styles.inlineFieldButton} onPress={openMeetingLink}>
              <Ionicons name="videocam" size={18} color={colors.accent} />
            </Pressable>
          )}
        </View>

        <View style={[styles.row, { marginTop: spacing.md }]}>
          <Text style={styles.label}>All day</Text>
          <Switch value={isAllDay} onValueChange={setIsAllDay} trackColor={{ true: colors.accent }} />
        </View>

        <DateTimePicker
          value={date}
          mode={isAllDay ? 'date' : 'datetime'}
          onChange={(_, selected) => selected && setDate(selected)}
          style={{ alignSelf: 'flex-start', marginBottom: spacing.lg }}
        />

        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.chipRow}>
          {(Object.keys(CATEGORY_STYLES) as EventCategory[]).map(cat => {
            const style = CATEGORY_STYLES[cat];
            const selected = category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => pickCategory(cat)}
                style={[styles.chip, { borderColor: style.color }, selected && { backgroundColor: style.color }]}
              >
                <Text style={{ color: selected ? colors.white : style.color, fontSize: 13, fontWeight: '500' }}>{style.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Repeat</Text>
        <View style={styles.chipRow}>
          {(['none', 'daily', 'weekly', 'monthly', 'yearly'] as RecurrenceRule[]).map(rule => (
            <Pressable
              key={rule}
              onPress={() => setRecurrence(rule)}
              style={[styles.chip, { borderColor: colors.surfaceDark }, recurrence === rule && { backgroundColor: colors.surfaceDark }]}
            >
              <Text style={{ color: recurrence === rule ? colors.textOnDark : colors.textPrimary, fontSize: 13, textTransform: 'capitalize', fontWeight: '500' }}>{rule}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Reminder</Text>
        <View style={styles.chipRow}>
          {REMINDER_OPTIONS.map(opt => (
            <Pressable
              key={opt.minutes}
              onPress={() => setReminderMinutes(opt.minutes)}
              style={[styles.chip, { borderColor: colors.surfaceDark }, reminderMinutes === opt.minutes && { backgroundColor: colors.surfaceDark }]}
            >
              <Text style={{ color: reminderMinutes === opt.minutes ? colors.textOnDark : colors.textPrimary, fontSize: 13, fontWeight: '500' }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        {editingEvent && !deleteChoiceOpen && (
          <Pressable style={styles.deleteButton} onPress={handleDeletePress}>
            <Text style={styles.deleteText}>Delete Event</Text>
          </Pressable>
        )}

        {editingEvent && deleteChoiceOpen && (
          <View style={styles.deleteChoiceBox}>
            <Text style={styles.deleteChoiceLabel}>This is a repeating event — what do you want to delete?</Text>
            <Pressable style={styles.deleteChoiceButton} onPress={handleDeleteThisOccurrence}>
              <Text style={styles.deleteText}>Just this occurrence</Text>
            </Pressable>
            <Pressable style={styles.deleteChoiceButton} onPress={handleDeleteSeries}>
              <Text style={styles.deleteText}>The entire series</Text>
            </Pressable>
            <Pressable style={styles.deleteChoiceButton} onPress={() => setDeleteChoiceOpen(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Cancel</Text>
            </Pressable>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
    title: { ...typography.body, fontSize: 16, color: colors.textPrimary },
    cancel: { color: colors.textSecondary, fontSize: 15 },
    save: { color: colors.accent, fontSize: 15, fontWeight: '700' },
    scopeWrapper: { position: 'relative', zIndex: 20, marginBottom: spacing.md },
    scopeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.sm,
      padding: spacing.md,
    },
    scopeButtonText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    scopeDropdown: {
      position: 'absolute',
      top: 68,
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
    scopeDropdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
    scopeDropdownDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    scopeDropdownRowSelected: { backgroundColor: colors.surface },
    scopeDropdownText: { fontSize: 14, color: colors.textPrimary },
    input: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, marginBottom: spacing.md, color: colors.textPrimary },
    inlineFieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    inlineFieldButton: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    label: { fontSize: 15, color: colors.textPrimary },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
    chip: { borderWidth: 1.5, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 2 },
    deleteButton: { marginTop: spacing.xxl, alignItems: 'center', padding: spacing.md },
    deleteText: { color: colors.holiday, fontSize: 15, fontWeight: '600' },
    deleteChoiceBox: { marginTop: spacing.xxl, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
    deleteChoiceLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm, textAlign: 'center' },
    deleteChoiceButton: { alignItems: 'center', padding: spacing.md },
  });
}
