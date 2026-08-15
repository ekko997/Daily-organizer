import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, ScrollView, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { OrganizerEvent, EventCategory, RecurrenceRule, CATEGORY_STYLES, REMINDER_OPTIONS, defaultsToYearlyRecurrence } from '../models/Event';
import { useEvents } from '../utils/EventsContext';
import { upsertEvent, deleteEvent as deleteEventFromStorage } from '../services/storageService';
import { scheduleReminder, cancelReminder } from '../services/notificationService';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialDate: Date;
  editingEventId: string | null;
}

export default function AddEditEventModal({ visible, onClose, initialDate, editingEventId }: Props) {
  const { events, refreshEvents } = useEvents();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const editingEvent = events.find(e => e.id === editingEventId) || null;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(initialDate);
  const [isAllDay, setIsAllDay] = useState(false);
  const [category, setCategory] = useState<EventCategory>('personal');
  const [recurrence, setRecurrence] = useState<RecurrenceRule>('none');
  const [reminderMinutes, setReminderMinutes] = useState(30);

  useEffect(() => {
    if (visible) {
      if (editingEvent) {
        setTitle(editingEvent.title);
        setNotes(editingEvent.notes);
        setDate(new Date(editingEvent.date));
        setIsAllDay(editingEvent.isAllDay);
        setCategory(editingEvent.category);
        setRecurrence(editingEvent.recurrence);
        setReminderMinutes(editingEvent.reminderMinutesBefore);
      } else {
        setTitle('');
        setNotes('');
        setDate(initialDate);
        setIsAllDay(false);
        setCategory('personal');
        setRecurrence('none');
        setReminderMinutes(30);
      }
    }
  }, [visible, editingEventId]);

  function pickCategory(cat: EventCategory) {
    setCategory(cat);
    if (defaultsToYearlyRecurrence(cat)) setRecurrence('yearly');
  }

  async function handleSave() {
    if (!title.trim()) return;
    const event: OrganizerEvent = {
      id: editingEvent?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      notes,
      date: date.toISOString(),
      isAllDay,
      category,
      recurrence,
      reminderMinutesBefore: reminderMinutes,
      createdAt: editingEvent?.createdAt ?? new Date().toISOString(),
    };
    await upsertEvent(event);
    await scheduleReminder(event);
    await refreshEvents();
    onClose();
  }

  async function handleDelete() {
    if (!editingEvent) return;
    await cancelReminder(editingEvent.id);
    await deleteEventFromStorage(editingEvent.id);
    await refreshEvents();
    onClose();
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

        <TextInput
          style={styles.input}
          placeholder="Title"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, { height: 70 }]}
          placeholder="Notes"
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <View style={styles.row}>
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

        {editingEvent && (
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteText}>Delete Event</Text>
          </Pressable>
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
    input: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, marginBottom: spacing.md, color: colors.textPrimary },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    label: { fontSize: 15, color: colors.textPrimary },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
    chip: { borderWidth: 1.5, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 2 },
    deleteButton: { marginTop: spacing.xxl, alignItems: 'center', padding: spacing.md },
    deleteText: { color: colors.holiday, fontSize: 15, fontWeight: '600' },
  });
}
