import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, ScrollView, Switch, KeyboardAvoidingView, Platform, Linking, Share, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { EventCategory, RecurrenceRule, CATEGORY_STYLES, REMINDER_OPTIONS, defaultsToYearlyRecurrence } from '../models/Event';
import { useEvents } from '../utils/EventsContext';
import { useAuth } from '../utils/AuthContext';
import { useFamily } from '../utils/FamilyContext';
import { memberDisplayName } from '../utils/memberColor';
import { CloudEvent, upsertCloudEvent, deleteCloudEvent } from '../services/cloudEventService';
import { scheduleReminder, cancelReminder } from '../services/notificationService';
import { uploadEventPhoto, deleteEventPhoto } from '../services/eventPhotoService';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { capitalizeFirst } from '../utils/textUtils';
import { useToast } from '../utils/ToastContext';
import { haptics } from '../utils/haptics';
import { Ionicons } from '@expo/vector-icons';

const QUICK_PRESETS: { title: string; category: EventCategory }[] = [
  { title: 'Dentist', category: 'appointment' },
  { title: 'Doctor', category: 'appointment' },
  { title: 'Team meeting', category: 'meeting' },
  { title: 'Call', category: 'work' },
  { title: 'Birthday', category: 'birthday' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  initialDate: Date;
  editingEventId: string | null;
  // The specific occurrence date the user tapped (only meaningful for a
  // recurring event) — lets "delete this occurrence only" know which date
  // to exclude, without affecting the rest of the series.
  occurrenceDate?: Date;
  // Prefills a brand-new event's fields (e.g. from AI-parsed natural
  // language) — the person still reviews everything before saving, nothing
  // here saves automatically.
  draft?: { title: string; date: Date; isAllDay: boolean; category: EventCategory; location: string | null };
}

export default function AddEditEventModal({ visible, onClose, initialDate, editingEventId, occurrenceDate, draft }: Props) {
  const { events, activeScope } = useEvents();
  const { user } = useAuth();
  const { family, members } = useFamily();
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
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [category, setCategory] = useState<EventCategory>('personal');
  const [recurrence, setRecurrence] = useState<RecurrenceRule>('none');
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [selectedScope, setSelectedScope] = useState<'personal' | 'family'>('personal');
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [deleteChoiceOpen, setDeleteChoiceOpen] = useState(false);
  const [saveChoiceOpen, setSaveChoiceOpen] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const currentScope = editingEvent?.scope ?? selectedScope;

  // Best-effort conflict check: flags another event at the exact same
  // date/time on the same calendar. (Doesn't account for future occurrences
  // of recurring events beyond their stored start date — full recurrence-aware
  // overlap detection would need event durations, which we don't track yet.)
  const conflictingEvent = useMemo(() => {
    if (isAllDay) return null;
    return events.find(e =>
      e.id !== editingEvent?.id &&
      e.scope === currentScope &&
      !e.isAllDay &&
      new Date(e.date).getTime() === date.getTime()
    ) || null;
  }, [events, date, isAllDay, currentScope, editingEvent]);

  useEffect(() => {
    if (visible) {
      if (editingEvent) {
        // If this specific occurrence has its own override (title/notes/
        // location/meetingLink), show those instead of the base series values.
        const override = occurrenceDate ? editingEvent.occurrenceOverrides?.[format(occurrenceDate, 'yyyy-MM-dd')] : undefined;
        setTitle(override?.title ?? editingEvent.title);
        setNotes(override?.notes ?? editingEvent.notes);
        setLocation(override?.location ?? editingEvent.location ?? '');
        setMeetingLink(override?.meetingLink ?? editingEvent.meetingLink ?? '');
        setDate(new Date(editingEvent.date));
        setIsAllDay(editingEvent.isAllDay);
        setIsMultiDay(!!editingEvent.endDate);
        setEndDate(editingEvent.endDate ? new Date(editingEvent.endDate) : null);
        setCategory(editingEvent.category);
        setRecurrence(editingEvent.recurrence);
        setReminderMinutes(editingEvent.reminderMinutesBefore);
        setAssignedTo(editingEvent.assignedTo);
        setPhotoUrl(editingEvent.photoUrl);
      } else {
        setTitle(draft?.title ?? '');
        setNotes('');
        setLocation(draft?.location ?? '');
        setMeetingLink('');
        setDate(draft?.date ?? initialDate);
        setIsAllDay(draft?.isAllDay ?? false);
        setIsMultiDay(false);
        setEndDate(null);
        setCategory(draft?.category ?? 'personal');
        setRecurrence('none');
        setReminderMinutes(30);
        setSelectedScope(activeScope);
        setAssignedTo(undefined);
        setPhotoUrl(undefined);
      }
      setScopeDropdownOpen(false);
      setAssignDropdownOpen(false);
      setDeleteChoiceOpen(false);
      setSaveChoiceOpen(false);
      setTitleError(false);
    }
  }, [visible, editingEventId]);

  function pickCategory(cat: EventCategory) {
    haptics.light();
    setCategory(cat);
    if (defaultsToYearlyRecurrence(cat)) setRecurrence('yearly');
    // Meeting link only makes sense for the Meeting category — clear it if
    // switching away, so a stale link doesn't silently get saved.
    if (cat !== 'meeting') setMeetingLink('');
  }

  async function handleSave() {
    if (!title.trim()) {
      setTitleError(true);
      haptics.warning();
      showToast({ message: 'Give this event a title before saving' });
      return;
    }
    if (!user) {
      showToast({ message: "Couldn't save — you're not signed in. Try signing out and back in." });
      return;
    }
    setTitleError(false);

    // Editing a specific occurrence of a recurring event needs to ask which
    // scope the changes apply to before actually saving anything.
    if (editingEvent && editingEvent.recurrence !== 'none' && occurrenceDate) {
      setSaveChoiceOpen(true);
      return;
    }
    await performSeriesSave();
  }

  async function performSeriesSave() {
    if (!user) return;
    // Editing keeps the event's original scope/owner; new events use whichever
    // calendar (Personal / Family) was picked in this form.
    const scope = editingEvent?.scope ?? selectedScope;
    const event: CloudEvent = {
      id: editingEvent?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      notes,
      location: location.trim() || undefined,
      meetingLink: category === 'meeting' ? (meetingLink.trim() || undefined) : undefined,
      date: date.toISOString(),
      isAllDay,
      category,
      recurrence,
      reminderMinutesBefore: reminderMinutes,
      createdAt: editingEvent?.createdAt ?? new Date().toISOString(),
      ownerId: editingEvent?.ownerId ?? user.uid,
      scope,
      familyId: scope === 'family' ? (family?.id ?? null) : null,
      assignedTo: scope === 'family' ? assignedTo : undefined,
      lastModifiedBy: user.uid,
      excludedDates: editingEvent?.excludedDates,
      endDate: (isMultiDay && recurrence === 'none' && endDate) ? endDate.toISOString() : undefined,
      occurrenceOverrides: editingEvent?.occurrenceOverrides,
      photoUrl,
    };
    try {
      await upsertCloudEvent(event);
      await scheduleReminder(event);
      haptics.success();
      showToast({ message: editingEvent ? 'Event updated' : 'Event added' });
      setSaveChoiceOpen(false);
      onClose();
    } catch (err: any) {
      // Guarantees a save can never fail silently again — whatever the
      // actual cause, the person sees a reason instead of nothing happening.
      haptics.warning();
      showToast({ message: `Couldn't save: ${err?.message || 'unknown error'}`, duration: 5000 });
    }
  }

  /** Saves title/notes/location/meetingLink changes to just this occurrence,
   * via an override — leaves the rest of the series and this event's date/
   * category/recurrence/reminder untouched. */
  async function performOccurrenceSave() {
    if (!user || !editingEvent || !occurrenceDate) return;
    const key = format(occurrenceDate, 'yyyy-MM-dd');
    const updated: CloudEvent = {
      ...editingEvent,
      lastModifiedBy: user.uid,
      occurrenceOverrides: {
        ...(editingEvent.occurrenceOverrides || {}),
        [key]: {
          title: title.trim(),
          notes,
          location: location.trim() || undefined,
          meetingLink: category === 'meeting' ? (meetingLink.trim() || undefined) : undefined,
        },
      },
    };
    try {
      await upsertCloudEvent(updated);
      haptics.success();
      showToast({ message: 'This occurrence updated' });
      setSaveChoiceOpen(false);
      onClose();
    } catch (err: any) {
      haptics.warning();
      showToast({ message: `Couldn't save: ${err?.message || 'unknown error'}`, duration: 5000 });
    }
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
    if (editingEvent.photoUrl) deleteEventPhoto(editingEvent.id).catch(() => {});
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

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ message: 'Photo access is needed to attach a picture' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setPhotoUploading(true);
    try {
      // Use a stable id even for a not-yet-saved new event, so the photo
      // has somewhere consistent to live once the event itself is saved.
      const idForUpload = editingEvent?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const url = await uploadEventPhoto(idForUpload, result.assets[0].uri);
      setPhotoUrl(url);
      haptics.light();
    } catch (err: any) {
      showToast({ message: `Couldn't upload photo: ${err?.message || 'unknown error'}` });
    } finally {
      setPhotoUploading(false);
    }
  }

  function handleRemovePhoto() {
    setPhotoUrl(undefined);
    if (editingEvent) deleteEventPhoto(editingEvent.id).catch(() => {});
  }

  async function handleDuplicate() {
    if (!editingEvent || !user) return;
    const duplicate: CloudEvent = {
      ...editingEvent,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: `${editingEvent.title} (copy)`,
      createdAt: new Date().toISOString(),
      lastModifiedBy: user.uid,
      excludedDates: undefined,
    };
    await upsertCloudEvent(duplicate);
    await scheduleReminder(duplicate);
    haptics.success();
    showToast({ message: 'Event duplicated' });
    onClose();
  }

  async function handleShareEvent() {
    if (!editingEvent) return;
    const lines = [
      editingEvent.title,
      format(new Date(editingEvent.date), editingEvent.isAllDay ? 'EEEE, MMMM d' : 'EEEE, MMMM d, h:mm a'),
      editingEvent.location ? `Location: ${editingEvent.location}` : '',
      editingEvent.notes || '',
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch { /* user cancelled */ }
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
          <Pressable style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.6 }]} accessibilityLabel="Cancel" accessibilityRole="button" onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable>
          <Text style={styles.title}>{editingEvent ? 'Edit Event' : 'New Event'}</Text>
          <Pressable style={({ pressed }) => [styles.saveButton, pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]} accessibilityLabel="Save event" accessibilityRole="button" onPress={handleSave}><Text style={styles.save}>Save</Text></Pressable>
        </View>

        {saveChoiceOpen && (
          <View style={styles.deleteChoiceBox}>
            <Text style={styles.deleteChoiceLabel}>
              This is a repeating event. Title, notes, location, and meeting link changes can apply to just this date —
              date, category, and repeat settings only apply if you choose the entire series.
            </Text>
            <Pressable style={styles.deleteChoiceButton} onPress={performOccurrenceSave}>
              <Text style={styles.saveChoiceConfirm}>Just this occurrence</Text>
            </Pressable>
            <Pressable style={styles.deleteChoiceButton} onPress={performSeriesSave}>
              <Text style={styles.saveChoiceConfirm}>The entire series</Text>
            </Pressable>
            <Pressable style={styles.deleteChoiceButton} onPress={() => setSaveChoiceOpen(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {editingEvent && (
          <View style={styles.quickActionsRow}>
            <Pressable style={styles.quickActionButton} onPress={handleDuplicate} accessibilityLabel="Duplicate event" accessibilityRole="button">
              <Ionicons name="copy-outline" size={14} color={colors.textPrimary} />
              <Text style={styles.quickActionText}>Duplicate</Text>
            </Pressable>
            <Pressable style={styles.quickActionButton} onPress={handleShareEvent} accessibilityLabel="Share event" accessibilityRole="button">
              <Ionicons name="share-outline" size={14} color={colors.textPrimary} />
              <Text style={styles.quickActionText}>Share</Text>
            </Pressable>
          </View>
        )}

        {!editingEvent && family && (
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

        {currentScope === 'family' && members.length > 0 && (
          <View style={styles.scopeWrapper}>
            <Text style={styles.sectionLabel}>Whose event is this?</Text>
            <Pressable style={styles.scopeButton} onPress={() => setAssignDropdownOpen(!assignDropdownOpen)}>
              <Ionicons name="person-circle-outline" size={16} color={colors.accent} />
              <Text style={styles.scopeButtonText} numberOfLines={1}>
                {assignedTo ? memberDisplayName(members.find(m => m.uid === assignedTo)) : 'Unassigned'}
              </Text>
              <Ionicons name={assignDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
            </Pressable>

            {assignDropdownOpen && (
              <View style={styles.scopeDropdown}>
                <Pressable
                  style={[styles.scopeDropdownRow, !assignedTo && styles.scopeDropdownRowSelected]}
                  onPress={() => { setAssignedTo(undefined); setAssignDropdownOpen(false); }}
                >
                  <Text style={styles.scopeDropdownText}>Unassigned</Text>
                </Pressable>
                {members.map((m, i) => (
                  <Pressable
                    key={m.uid}
                    style={[styles.scopeDropdownRow, styles.scopeDropdownDivider, assignedTo === m.uid && styles.scopeDropdownRowSelected]}
                    onPress={() => { setAssignedTo(m.uid); setAssignDropdownOpen(false); }}
                  >
                    <Text style={styles.scopeDropdownText} numberOfLines={1}>{memberDisplayName(m)}{m.uid === user?.uid ? ' (you)' : ''}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {!editingEvent && !title && (
          <View style={styles.presetRow}>
            {QUICK_PRESETS.map(preset => (
              <Pressable
                key={preset.title}
                style={styles.presetChip}
                onPress={() => { setTitle(preset.title); setCategory(preset.category); if (defaultsToYearlyRecurrence(preset.category)) setRecurrence('yearly'); }}
              >
                <Ionicons name={CATEGORY_STYLES[preset.category].icon as any} size={12} color={colors.textSecondary} />
                <Text style={styles.presetChipText}>{preset.title}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          style={[styles.input, focusedField === 'title' && styles.inputFocused, titleError && styles.inputError]}
          placeholder="Title"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={text => { setTitle(capitalizeFirst(text)); if (titleError) setTitleError(false); }}
          onFocus={() => setFocusedField('title')}
          onBlur={() => setFocusedField(null)}
        />
        {titleError && <Text style={styles.fieldErrorText}>A title is required</Text>}

        <TextInput
          style={[styles.input, { height: 70 }, focusedField === 'notes' && styles.inputFocused]}
          placeholder="Notes — shows in your reminder too, e.g. 'bring the shoes'"
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          onFocus={() => setFocusedField('notes')}
          onBlur={() => setFocusedField(null)}
          multiline
        />

        <View style={styles.inlineFieldRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }, focusedField === 'location' && styles.inputFocused]}
            placeholder="Location (optional)"
            placeholderTextColor={colors.textSecondary}
            value={location}
            onChangeText={setLocation}
            onFocus={() => setFocusedField('location')}
            onBlur={() => setFocusedField(null)}
          />
          {location.trim().length > 0 && (
            <Pressable style={styles.inlineFieldButton} onPress={openLocation}>
              <Ionicons name="navigate" size={18} color={colors.accent} />
            </Pressable>
          )}
        </View>

        {photoUrl ? (
          <View style={styles.photoPreviewWrapper}>
            <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
            <Pressable style={styles.photoRemoveButton} onPress={handleRemovePhoto} accessibilityLabel="Remove photo" accessibilityRole="button">
              <Ionicons name="close" size={16} color={colors.white} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.photoAddButton} onPress={handlePickPhoto} disabled={photoUploading}>
            {photoUploading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.photoAddText}>Attach a photo (optional)</Text>
              </>
            )}
          </Pressable>
        )}

        {category === 'meeting' && (
          <View style={[styles.inlineFieldRow, { marginTop: spacing.md }]}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }, focusedField === 'meetingLink' && styles.inputFocused]}
              placeholder="Meeting link (Zoom, Teams...)"
              placeholderTextColor={colors.textSecondary}
              value={meetingLink}
              onChangeText={setMeetingLink}
              onFocus={() => setFocusedField('meetingLink')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="none"
              keyboardType="url"
            />
            {meetingLink.trim().length > 0 && (
              <Pressable style={styles.inlineFieldButton} onPress={openMeetingLink}>
                <Ionicons name="videocam" size={18} color={colors.accent} />
              </Pressable>
            )}
          </View>
        )}

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

        {recurrence === 'none' && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Multi-day (e.g. a trip)</Text>
              <Switch
                value={isMultiDay}
                onValueChange={value => {
                  setIsMultiDay(value);
                  if (value && !endDate) setEndDate(date);
                }}
                trackColor={{ true: colors.accent }}
              />
            </View>
            {isMultiDay && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.sectionLabel}>Ends</Text>
                <DateTimePicker
                  value={endDate || date}
                  mode="date"
                  minimumDate={date}
                  onChange={(_, selected) => selected && setEndDate(selected)}
                  style={{ alignSelf: 'flex-start' }}
                />
              </View>
            )}
          </>
        )}

        {conflictingEvent && (
          <View style={styles.conflictBanner}>
            <Ionicons name="warning" size={16} color={colors.holiday} />
            <Text style={styles.conflictText}>Overlaps with "{conflictingEvent.title}" at the same time</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.chipRow}>
          {(Object.keys(CATEGORY_STYLES) as EventCategory[]).map(cat => {
            const style = CATEGORY_STYLES[cat];
            const selected = category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => pickCategory(cat)}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: style.color },
                  selected && { backgroundColor: style.color },
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
              >
                <Text style={{ color: selected ? colors.white : style.color, fontSize: 13, fontWeight: '500' }} maxFontSizeMultiplier={1.3}>{style.label}</Text>
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
              <Text style={{ color: recurrence === rule ? colors.textOnDark : colors.textPrimary, fontSize: 13, textTransform: 'capitalize', fontWeight: '500' }} maxFontSizeMultiplier={1.3}>{rule}</Text>
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
              <Text style={{ color: reminderMinutes === opt.minutes ? colors.textOnDark : colors.textPrimary, fontSize: 13, fontWeight: '500' }} maxFontSizeMultiplier={1.3}>{opt.label}</Text>
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
    quickActionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, marginTop: -spacing.md },
    quickActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    quickActionText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
    presetChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 5 },
    presetChipText: { fontSize: 11, color: colors.textSecondary },
    title: { ...typography.body, fontSize: 16, color: colors.textPrimary },
    cancelButton: { backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    cancel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    saveButton: { backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    save: { color: colors.white, fontSize: 14, fontWeight: '700' },
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
    input: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, marginBottom: spacing.md, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
    inputFocused: { borderColor: colors.accent, borderWidth: 1.5 },
    photoAddButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: spacing.md, marginBottom: spacing.md, height: 48 },
    photoAddText: { fontSize: 13, color: colors.textSecondary },
    photoPreviewWrapper: { position: 'relative', marginBottom: spacing.md },
    photoPreview: { width: '100%', height: 160, borderRadius: radii.sm },
    photoRemoveButton: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    inputError: { borderWidth: 1.5, borderColor: colors.holiday },
    fieldErrorText: { color: colors.holiday, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md },
    conflictBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.holidayBg, borderRadius: radii.sm, padding: spacing.sm + 2, marginBottom: spacing.md },
    conflictText: { flex: 1, fontSize: 12, color: colors.textPrimary },
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
    saveChoiceConfirm: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  });
}
