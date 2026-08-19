import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { useEvents } from '../utils/EventsContext';
import { occurrencesInRange } from '../services/recurrenceEngine';
import { CATEGORY_STYLES } from '../models/Event';
import { loadForecast, weatherIcon, weatherLabel, DailyForecast } from '../services/weatherService';
import { deleteCloudEvent, upsertCloudEvent, CloudEvent } from '../services/cloudEventService';
import { cancelReminder, scheduleReminder } from '../services/notificationService';
import { spacing, radii, typography, cardShadow, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { useToast } from '../utils/ToastContext';
import { haptics } from '../utils/haptics';
import { colorForMember } from '../utils/memberColor';
import AddEditEventModal from './AddEditEventModal';
import SwipeableRow from '../components/SwipeableRow';
import ScreenTransition from '../components/ScreenTransition';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const { events, latitude, longitude } = useEvents();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState<Date | undefined>(undefined);
  const [todayForecast, setTodayForecast] = useState<DailyForecast | null>(null);

  const today = new Date();

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    loadForecast(latitude, longitude).then(days => {
      const todayKey = format(today, 'yyyy-MM-dd');
      setTodayForecast(days.find(d => d.date === todayKey) || null);
    });
  }, [latitude, longitude]);

  const todaysEvents = useMemo(() => {
    const start = startOfDay(today);
    const end = endOfDay(today);
    const items: { event: (typeof events)[number]; occurrenceDate: Date }[] = [];
    for (const event of events) {
      for (const occ of occurrencesInRange(event, start, end)) {
        items.push({ event, occurrenceDate: occ });
      }
    }
    return items.sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());
  }, [events]);

  const tomorrowsEvents = useMemo(() => {
    const tomorrow = addDays(today, 1);
    const start = startOfDay(tomorrow);
    const end = endOfDay(tomorrow);
    const items: { event: (typeof events)[number]; occurrenceDate: Date }[] = [];
    for (const event of events) {
      for (const occ of occurrencesInRange(event, start, end)) {
        items.push({ event, occurrenceDate: occ });
      }
    }
    return items.sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());
  }, [events]);

  const nextUpEvent = todaysEvents.find(item => item.occurrenceDate > new Date());

  const weekEventCount = useMemo(() => {
    const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday, matching the calendar grid
    const end = endOfWeek(today, { weekStartsOn: 1 });
    let count = 0;
    for (const event of events) {
      count += occurrencesInRange(event, start, end).length;
    }
    return count;
  }, [events]);

  async function handleDeleteEvent(event: CloudEvent) {
    haptics.warning();
    await cancelReminder(event.id);
    await deleteCloudEvent(event.id);
    showToast({
      message: `"${event.title}" deleted`,
      actionLabel: 'Undo',
      onAction: async () => {
        await upsertCloudEvent(event);
        await scheduleReminder(event);
        haptics.success();
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenTransition>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <View style={styles.dateRow}>
            <Text style={styles.date}>{format(today, 'EEEE, MMMM d')}</Text>
            {todayForecast && (
              <View style={styles.weatherChip}>
                <Ionicons name={weatherIcon(todayForecast.weatherCode) as any} size={16} color={colors.accent} />
                <Text style={styles.weatherText}>{Math.round(todayForecast.tempMaxC)}° / {Math.round(todayForecast.tempMinC)}°</Text>
              </View>
            )}
          </View>
        </View>

        {nextUpEvent && (
          <View style={styles.nextUpCard}>
            <Text style={styles.nextUpLabel}>NEXT UP</Text>
            <Text style={styles.nextUpTitle}>{nextUpEvent.event.title}</Text>
            <Text style={styles.nextUpTime}>
              {nextUpEvent.event.isAllDay ? 'All day' : format(nextUpEvent.occurrenceDate, 'h:mm a')}
            </Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryNumber}>{todaysEvents.length}</Text>
            <Text style={styles.summaryLabel}>Today</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryNumber}>{tomorrowsEvents.length}</Text>
            <Text style={styles.summaryLabel}>Tomorrow</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryNumber}>{weekEventCount}</Text>
            <Text style={styles.summaryLabel}>This Week</Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Today</Text>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressedShrink]}
            accessibilityLabel="Add event"
            accessibilityRole="button"
            onPress={() => { setEditingEventId(null); setEditingOccurrenceDate(undefined); setModalVisible(true); }}
          >
            <Ionicons name="add" size={20} color={colors.white} />
          </Pressable>
        </View>

        {todaysEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="sunny-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Nothing on today — enjoy the clear schedule</Text>
          </View>
        ) : (
          todaysEvents.map(({ event, occurrenceDate }, i) => {
            const style = CATEGORY_STYLES[event.category];
            return (
              <SwipeableRow key={`${event.id}-${i}`} onDelete={() => handleDeleteEvent(event)} style={{ marginBottom: spacing.sm }}>
                <Pressable
                  style={({ pressed }) => [styles.eventRow, { borderLeftColor: style.color }, pressed && styles.pressedDim]}
                  onPress={() => { setEditingEventId(event.id); setEditingOccurrenceDate(occurrenceDate); setModalVisible(true); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {!event.isAllDay && (
                      <Text style={styles.eventTime}>{format(occurrenceDate, 'h:mm a')}</Text>
                    )}
                  </View>
                  <View style={[styles.categoryBadge, { backgroundColor: style.color + '22' }]}>
                    <Ionicons name={style.icon as any} size={14} color={style.color} />
                    {event.assignedTo && (
                      <View style={[styles.memberDot, { backgroundColor: colorForMember(event.assignedTo) }]} />
                    )}
                  </View>
                </Pressable>
              </SwipeableRow>
            );
          })
        )}

        {tomorrowsEvents.length > 0 && (
          <>
            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Tomorrow</Text>
            {tomorrowsEvents.map(({ event, occurrenceDate }, i) => {
              const style = CATEGORY_STYLES[event.category];
              return (
                <Pressable
                  key={`${event.id}-tmrw-${i}`}
                  style={({ pressed }) => [styles.eventRow, { borderLeftColor: style.color, opacity: pressed ? 0.5 : 0.75 }]}
                  onPress={() => { setEditingEventId(event.id); setEditingOccurrenceDate(occurrenceDate); setModalVisible(true); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {!event.isAllDay && (
                      <Text style={styles.eventTime}>{format(occurrenceDate, 'h:mm a')}</Text>
                    )}
                  </View>
                  <View style={[styles.categoryBadge, { backgroundColor: style.color + '22' }]}>
                    <Ionicons name={style.icon as any} size={14} color={style.color} />
                    {event.assignedTo && (
                      <View style={[styles.memberDot, { backgroundColor: colorForMember(event.assignedTo) }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
      </ScreenTransition>

      <AddEditEventModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialDate={today}
        editingEventId={editingEventId}
        occurrenceDate={editingOccurrenceDate}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing.xl, paddingBottom: 40 },
    header: { marginBottom: spacing.xl },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    weatherChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
    weatherText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    greeting: { ...typography.greeting, color: colors.textSecondary },
    date: { ...typography.screenTitle, marginTop: 2, color: colors.textPrimary },
    nextUpCard: {
      backgroundColor: colors.surfaceDark,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...cardShadow,
    },
    nextUpLabel: { ...typography.label, color: colors.textOnDarkMuted },
    nextUpTitle: { ...typography.cardTitle, color: colors.textOnDark, marginTop: 6 },
    nextUpTime: { color: colors.textOnDarkMuted, fontSize: 13, marginTop: 4 },
    summaryRow: { flexDirection: 'row', gap: spacing.sm + 2, marginBottom: spacing.xxl },
    summaryPill: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg - 2, alignItems: 'center', ...cardShadow },
    summaryNumber: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
    summaryLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md - 2 },
    sectionHeader: { ...typography.sectionHeader, color: colors.textPrimary, marginBottom: spacing.md - 2 },
    addButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 30 },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderLeftWidth: 4,
      borderRadius: radii.sm,
      padding: spacing.md,
      ...cardShadow,
    },
    eventTitle: { ...typography.body, color: colors.textPrimary },
    eventTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    pressedShrink: { transform: [{ scale: 0.94 }], opacity: 0.85 },
    pressedDim: { opacity: 0.6 },
    categoryBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    memberDot: { position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: colors.background },
  });
}
