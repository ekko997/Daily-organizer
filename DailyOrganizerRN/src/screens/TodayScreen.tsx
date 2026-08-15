import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfDay, endOfDay, addDays, isSameDay } from 'date-fns';
import { useEvents } from '../utils/EventsContext';
import { occurrencesInRange } from '../services/recurrenceEngine';
import { CATEGORY_STYLES } from '../models/Event';
import { colors, spacing, radii, typography } from '../utils/theme';
import AddEditEventModal from './AddEditEventModal';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const { events } = useEvents();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const today = new Date();

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.date}>{format(today, 'EEEE, MMMM d')}</Text>
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
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Today</Text>
          <Pressable style={styles.addButton} onPress={() => { setEditingEventId(null); setModalVisible(true); }}>
            <Ionicons name="add" size={20} color={colors.textOnDark} />
          </Pressable>
        </View>

        {todaysEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="sunny-outline" size={32} color="#B9BAC0" />
            <Text style={styles.emptyText}>Nothing on today — enjoy the clear schedule</Text>
          </View>
        ) : (
          todaysEvents.map(({ event, occurrenceDate }, i) => {
            const style = CATEGORY_STYLES[event.category];
            return (
              <Pressable
                key={`${event.id}-${i}`}
                style={[styles.eventRow, { borderLeftColor: style.color }]}
                onPress={() => { setEditingEventId(event.id); setModalVisible(true); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {!event.isAllDay && (
                    <Text style={styles.eventTime}>{format(occurrenceDate, 'h:mm a')}</Text>
                  )}
                </View>
                <View style={[styles.categoryBadge, { backgroundColor: style.color + '22' }]}>
                  <Ionicons name={style.icon as any} size={14} color={style.color} />
                </View>
              </Pressable>
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
                  style={[styles.eventRow, { borderLeftColor: style.color, opacity: 0.75 }]}
                  onPress={() => { setEditingEventId(event.id); setModalVisible(true); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {!event.isAllDay && (
                      <Text style={styles.eventTime}>{format(occurrenceDate, 'h:mm a')}</Text>
                    )}
                  </View>
                  <View style={[styles.categoryBadge, { backgroundColor: style.color + '22' }]}>
                    <Ionicons name={style.icon as any} size={14} color={style.color} />
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      <AddEditEventModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialDate={today}
        editingEventId={editingEventId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.xl, paddingBottom: 40 },
  header: { marginBottom: spacing.xl },
  greeting: { ...typography.greeting, color: colors.textSecondary },
  date: { ...typography.screenTitle, marginTop: 2, color: colors.textPrimary },
  nextUpCard: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  nextUpLabel: { ...typography.label, color: '#B9BAC0' },
  nextUpTitle: { ...typography.cardTitle, color: colors.textOnDark, marginTop: 6 },
  nextUpTime: { color: colors.textOnDarkMuted, fontSize: 13, marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm + 2, marginBottom: spacing.xxl },
  summaryPill: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg - 2, alignItems: 'center' },
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
    marginBottom: spacing.sm,
  },
  eventTitle: { ...typography.body, color: colors.textPrimary },
  eventTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  categoryBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
