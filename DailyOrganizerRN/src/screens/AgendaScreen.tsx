import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addYears, startOfToday } from 'date-fns';
import { useEvents } from '../utils/EventsContext';
import { occurrencesInRange } from '../services/recurrenceEngine';
import { CATEGORY_STYLES } from '../models/Event';
import AddEditEventModal from './AddEditEventModal';

export default function AgendaScreen() {
  const { events } = useEvents();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Expand every event (including recurring ones) into individual occurrences
  // over the next 12 months, so a yearly birthday shows on every future date.
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
          <Ionicons name="calendar-outline" size={40} color="#B9BAC0" />
          <Text style={styles.emptyText}>No events yet</Text>
          <Text style={styles.emptySubtext}>Add one from the Calendar tab</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item: any, index) => `${item.id}-${index}`}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item }: any) => {
            const style = CATEGORY_STYLES[item.category];
            return (
              <Pressable
                style={styles.row}
                onPress={() => { setEditingEventId(item.id); setModalVisible(true); }}
              >
                <Ionicons name={style.icon as any} size={18} color={style.color} />
                <View style={{ flex: 1, marginLeft: 10 }}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: '600', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  sectionHeader: { fontSize: 13, fontWeight: '600', color: '#8C8C90', marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F7', borderRadius: 10, padding: 12, marginBottom: 6 },
  rowTitle: { fontSize: 14, fontWeight: '500' },
  rowTime: { fontSize: 12, color: '#8C8C90', marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText: { fontSize: 15, fontWeight: '500', color: '#111113' },
  emptySubtext: { fontSize: 13, color: '#8C8C90' },
});
