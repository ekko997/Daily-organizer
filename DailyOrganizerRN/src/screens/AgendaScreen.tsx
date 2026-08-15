import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addYears, startOfToday } from 'date-fns';
import { useEvents } from '../utils/EventsContext';
import { occurrencesInRange } from '../services/recurrenceEngine';
import { CATEGORY_STYLES } from '../models/Event';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import AddEditEventModal from './AddEditEventModal';

export default function AgendaScreen() {
  const { events } = useEvents();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const sections = useMemo(() => {
    const start = startOfToday();
    const end = addYears(start, 1);
    const occurrences: { date: Date; eventId: string }[] = [];

    for (const event of events) {
      for (const occ of occurrencesInRange(event, start, end)) {
        occurrences.push({ date: occ, eventId: event.id });
      }
    }
    occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());

    const grouped = new Map<string, { date: Date; eventId: string }[]>();
    for (const occ of occurrences) {
      const key = format(occ.date, 'yyyy-MM-dd');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(occ);
    }

    return Array.from(grouped.entries()).map(([key, items]) => ({
      title: format(items[0].date, 'EEEE, MMM d'),
      data: items.map(item => ({ ...events.find(e => e.id === item.eventId)!, occurrenceDate: item.date })),
    }));
  }, [events]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Agenda</Text>
      {sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={36} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No events yet</Text>
          <Text style={styles.emptySubtext}>Add one from the Calendar tab</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item: any, index) => `${item.id}-${index}`}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item }: any) => {
            const style = CATEGORY_STYLES[item.category];
            return (
              <Pressable
                style={styles.row}
                onPress={() => { setEditingEventId(item.id); setModalVisible(true); }}
              >
                <View style={[styles.categoryBadge, { backgroundColor: style.color + '22' }]}>
                  <Ionicons name={style.icon as any} size={14} color={style.color} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  {!item.isAllDay && <Text style={styles.rowTime}>{format(new Date(item.date), 'h:mm a')}</Text>}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <AddEditEventModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialDate={new Date()}
        editingEventId={editingEventId}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { ...typography.screenTitle, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm, color: colors.textPrimary },
    sectionHeader: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, marginBottom: spacing.xs },
    categoryBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { ...typography.body, color: colors.textPrimary },
    rowTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    emptyText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    emptySubtext: { fontSize: 13, color: colors.textSecondary },
  });
}
