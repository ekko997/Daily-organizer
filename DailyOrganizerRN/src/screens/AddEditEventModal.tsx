import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, ScrollView, Switch, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { OrganizerEvent, EventCategory, RecurrenceRule, CATEGORY_STYLES, REMINDER_OPTIONS, defaultsToYearlyRecurrence } from '../models/Event';
import { useEvents } from '../utils/EventsContext';
import { upsertEvent, deleteEvent as deleteEventFromStorage } from '../services/storageService';
import { scheduleReminder, cancelReminder } from '../services/notificationService';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialDate: Date;
  editingEventId: string | null;
}

export default function AddEditEventModal({ visible, onClose, initialDate, editingEventId }: Props) {
  const { events, refreshEvents } = useEvents();
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
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
        <View style={styles.headerRow}>
          <Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable>
          <Text style={styles.title}>{editingEvent ? 'Edit Event' : 'New Event'}</Text>
          <Pressable onPress={handleSave}><Text style={styles.save}>Save</Text></Pressable>
        </View>

        <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
        <TextInput style={[styles.input, { height: 70 }]} placeholder="Notes" value={notes} onChangeText={setNotes} multiline />

        <View style={styles.row}>
          <Text style={styles.label}>All day</Text>
          <Switch value={isAllDay} onValueChange={setIsAllDay} />
        </View>

        <DateTimePicker
          value={date}
          mode={isAllDay ? 'date' : 'datetime'}
          onChange={(_, selected) => selected && setDate(selected)}
          style={{ alignSelf: 'flex-start', marginBottom: 16 }}
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
                <Text style={{ color: selected ? '#fff' : style.color, fontSize: 13 }}>{style.label}</Text>
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
              style={[styles.chip, { borderColor: '#111113' }, recurrence === rule && { backgroundColor: '#111113' }]}
            >
              <Text style={{ color: recurrence === rule ? '#fff' : '#111113', fontSize: 13, textTransform: 'capitalize' }}>{rule}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Reminder</Text>
        <View style={styles.chipRow}>
          {REMINDER_OPTIONS.map(opt => (
            <Pressable
              key={opt.minutes}
              onPress={() => setReminderMinutes(opt.minutes)}
              style={[styles.chip, { borderColor: '#111113' }, reminderMinutes === opt.minutes && { backgroundColor: '#111113' }]}
            >
              <Text style={{ color: reminderMinutes === opt.minutes ? '#fff' : '#111113', fontSize: 13 }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        {editingEvent && (
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteText}>Delete Event</Text>
          </Pressable>
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '600' },
  cancel: { color: '#8C8C90', fontSize: 15 },
  save: { color: '#5973E6', fontSize: 15, fontWeight: '600' },
  input: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 15 },
  sectionLabel: { fontSize: 13, color: '#8C8C90', marginTop: 8, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  deleteButton: { marginTop: 24, alignItems: 'center', padding: 12 },
  deleteText: { color: '#D9435C', fontSize: 15, fontWeight: '500' },
});
