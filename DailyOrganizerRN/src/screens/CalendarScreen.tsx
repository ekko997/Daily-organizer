import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, isSameMonth, endOfDay } from 'date-fns';
import { useEvents } from '../utils/EventsContext';
import { gridDates, isSameDay, dayStart, isoDateKey } from '../utils/dateUtils';
import { occurrencesInRange } from '../services/recurrenceEngine';
import { loadHolidays, PublicHoliday } from '../services/holidayService';
import { CATEGORY_STYLES } from '../models/Event';
import AddEditEventModal from './AddEditEventModal';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarScreen() {
  const { events, countryCode, region } = useEvents();
  const [displayedMonth, setDisplayedMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [holidays, setHolidays] = useState<Map<string, PublicHoliday>>(new Map());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  useEffect(() => {
    loadHolidays(countryCode, displayedMonth.getFullYear(), region || undefined).then(setHolidays);
  }, [countryCode, region, displayedMonth.getFullYear()]);

  const dates = useMemo(() => gridDates(displayedMonth), [displayedMonth]);

  function eventsOn(date: Date) {
    const start = dayStart(date);
    const end = endOfDay(date);
    return events.filter(e => occurrencesInRange(e, start, end).length > 0);
  }

  const selectedDayEvents = useMemo(
    () => eventsOn(selectedDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events, selectedDate]
  );
  const selectedHoliday = holidays.get(isoDateKey(selectedDate));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.monthLabel}>{format(displayedMonth, 'MMMM yyyy')}</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={() => setDisplayedMonth(addMonths(displayedMonth, -1))}>
            <Ionicons name="chevron-back" size={22} />
          </Pressable>
          <Pressable onPress={() => setDisplayedMonth(addMonths(displayedMonth, 1))}>
            <Ionicons name="chevron-forward" size={22} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {dates.map((date, i) => {
          const holiday = holidays.get(isoDateKey(date));
          const hasEvents = eventsOn(date).length > 0;
          const selected = isSameDay(date, selectedDate);
          const today = isSameDay(date, new Date());
          const currentMonth = isSameMonth(date, displayedMonth);

          return (
            <Pressable key={i} style={styles.dayCell} onPress={() => setSelectedDate(date)}>
              <View style={[
                styles.dayCircle,
                selected && styles.dayCircleSelected,
                !selected && holiday && styles.dayCircleHoliday,
                !selected && today && styles.dayCircleToday,
              ]}>
                <Text style={[
                  styles.dayText,
                  { opacity: currentMonth ? 1 : 0.3 },
                  selected && styles.dayTextSelected,
                  !selected && holiday && styles.dayTextHoliday,
                ]}>
                  {format(date, 'd')}
                </Text>
              </View>
              <View style={[styles.dot, { opacity: hasEvents ? 1 : 0 }]} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <View style={styles.detailHeader}>
        <Text style={styles.detailDate}>{format(selectedDate, 'EEEE, MMMM d')}</Text>
        <Pressable onPress={() => { setEditingEventId(null); setModalVisible(true); }}>
          <Ionicons name="add-circle" size={28} color="#5973E6" />
        </Pressable>
      </View>

      {selectedHoliday && (
        <View style={styles.holidayBanner}>
          <Ionicons name="star" size={16} color="#D9435C" />
          <Text style={styles.holidayText}>{selectedHoliday.localName}</Text>
          <Text style={styles.holidaySubtext}>Non-working day</Text>
        </View>
      )}

      <FlatList
        data={selectedDayEvents}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No events for this day</Text>}
        renderItem={({ item }) => {
          const style = CATEGORY_STYLES[item.category];
          return (
            <Pressable
              style={[styles.eventRow, { borderLeftColor: style.color }]}
              onPress={() => { setEditingEventId(item.id); setModalVisible(true); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                {!item.isAllDay && (
                  <Text style={styles.eventTime}>{format(new Date(item.date), 'h:mm a')}</Text>
                )}
              </View>
              <Ionicons name={style.icon as any} size={16} color={style.color} />
            </Pressable>
          );
        }}
      />

      <AddEditEventModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialDate={selectedDate}
        editingEventId={editingEventId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  monthLabel: { fontSize: 22, fontWeight: '600' },
  weekdayRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: '#8C8C90' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 4 },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: '#111113' },
  dayCircleHoliday: { backgroundColor: 'rgba(217,67,92,0.12)' },
  dayCircleToday: { borderWidth: 1, borderColor: '#111113' },
  dayText: { fontSize: 15 },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  dayTextHoliday: { color: '#D9435C' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#111113', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#EDEDEF', marginTop: 12 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  detailDate: { fontSize: 16, fontWeight: '600' },
  holidayBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  holidayText: { fontSize: 14, fontWeight: '500', flex: 1 },
  holidaySubtext: { fontSize: 12, color: '#8C8C90' },
  emptyText: { fontSize: 14, color: '#8C8C90', paddingTop: 4 },
  eventRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F7', borderLeftWidth: 4, borderRadius: 10, padding: 12, marginBottom: 8 },
  eventTitle: { fontSize: 14, fontWeight: '500' },
  eventTime: { fontSize: 12, color: '#8C8C90', marginTop: 2 },
});
