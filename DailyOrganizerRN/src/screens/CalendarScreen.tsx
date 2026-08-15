import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, isSameMonth, endOfDay } from 'date-fns';
import { useEvents } from '../utils/EventsContext';
import { gridDates, isSameDay, dayStart, isoDateKey } from '../utils/dateUtils';
import { occurrencesInRange } from '../services/recurrenceEngine';
import { loadHolidays, PublicHoliday } from '../services/holidayService';
import { loadForecast, weatherIcon, DailyForecast } from '../services/weatherService';
import { CATEGORY_STYLES } from '../models/Event';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { useFamily } from '../utils/FamilyContext';
import AddEditEventModal from './AddEditEventModal';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarScreen() {
  const { events, countryCode, region, latitude, longitude, activeScope, setActiveScope } = useEvents();
  const { family } = useFamily();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [displayedMonth, setDisplayedMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [holidays, setHolidays] = useState<Map<string, PublicHoliday>>(new Map());
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);

  useEffect(() => {
    loadHolidays(countryCode, displayedMonth.getFullYear(), region || undefined).then(setHolidays);
  }, [countryCode, region, displayedMonth.getFullYear()]);

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    loadForecast(latitude, longitude).then(setForecast);
  }, [latitude, longitude]);

  const selectedDayForecast = forecast.find(d => d.date === isoDateKey(selectedDate));

  const dates = useMemo(() => gridDates(displayedMonth), [displayedMonth]);
  const weeks = useMemo(() => {
    const chunks: Date[][] = [];
    for (let i = 0; i < dates.length; i += 7) chunks.push(dates.slice(i, i + 7));
    return chunks;
  }, [dates]);

  function eventsOn(date: Date) {
    const start = dayStart(date);
    const end = endOfDay(date);
    return events.filter(e => e.scope === activeScope && occurrencesInRange(e, start, end).length > 0);
  }

  const selectedDayEvents = useMemo(
    () => eventsOn(selectedDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events, selectedDate]
  );
  const selectedHoliday = holidays.get(isoDateKey(selectedDate));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SET UP APPOINTMENTS</Text>
          <Text style={styles.monthLabel}>{format(displayedMonth, 'MMMM yyyy')}</Text>
        </View>
        <View style={styles.monthNav}>
          <Pressable style={styles.navButton} onPress={() => setDisplayedMonth(addMonths(displayedMonth, -1))}>
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          </Pressable>
          <Pressable style={styles.navButton} onPress={() => setDisplayedMonth(addMonths(displayedMonth, 1))}>
            <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((date, i) => {
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
        ))}
      </View>

      <View style={styles.scopeSelectorWrapper}>
        <Pressable style={styles.scopeSelectorButton} onPress={() => setScopeDropdownOpen(!scopeDropdownOpen)}>
          <Ionicons name={activeScope === 'family' ? 'people' : 'person'} size={16} color={colors.accent} />
          <Text style={styles.scopeSelectorText}>{activeScope === 'family' ? (family?.name || 'Family') : 'Personal'}</Text>
          <Ionicons name={scopeDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
        </Pressable>

        {scopeDropdownOpen && (
          <View style={styles.scopeDropdown}>
            <Pressable
              style={[styles.scopeDropdownRow, activeScope === 'personal' && styles.scopeDropdownRowSelected]}
              onPress={() => { setActiveScope('personal'); setScopeDropdownOpen(false); }}
            >
              <Ionicons name="person" size={16} color={colors.textSecondary} />
              <Text style={styles.scopeDropdownText}>Personal</Text>
              {activeScope === 'personal' && <Ionicons name="checkmark" size={16} color={colors.accent} style={{ marginLeft: 'auto' }} />}
            </Pressable>
            <Pressable
              style={[styles.scopeDropdownRow, styles.scopeDropdownDivider, activeScope === 'family' && styles.scopeDropdownRowSelected]}
              onPress={() => { setActiveScope('family'); setScopeDropdownOpen(false); }}
            >
              <Ionicons name="people" size={16} color={colors.textSecondary} />
              <Text style={styles.scopeDropdownText}>{family?.name || 'Family'}</Text>
              {activeScope === 'family' && <Ionicons name="checkmark" size={16} color={colors.accent} style={{ marginLeft: 'auto' }} />}
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.detailHeader}>
        <Text style={styles.detailDate}>{format(selectedDate, 'EEEE, MMMM d')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {selectedDayForecast && (
            <View style={styles.weatherChip}>
              <Ionicons name={weatherIcon(selectedDayForecast.weatherCode) as any} size={14} color={colors.accent} />
              <Text style={styles.weatherText}>{Math.round(selectedDayForecast.tempMaxC)}°/{Math.round(selectedDayForecast.tempMinC)}°</Text>
            </View>
          )}
          <Pressable style={styles.addButton} onPress={() => { setEditingEventId(null); setModalVisible(true); }}>
            <Ionicons name="add" size={20} color={colors.white} />
          </Pressable>
        </View>
      </View>

      {selectedHoliday && (
        <View style={styles.holidayBanner}>
          <Ionicons name="star" size={14} color={colors.holiday} />
          <Text style={styles.holidayText}>{selectedHoliday.localName}</Text>
          <Text style={styles.holidaySubtext}>Non-working day</Text>
        </View>
      )}

      <FlatList
        data={selectedDayEvents}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={26} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Nothing scheduled — tap + to add something</Text>
          </View>
        }
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
              <View style={[styles.categoryBadge, { backgroundColor: style.color + '22' }]}>
                <Ionicons name={style.icon as any} size={14} color={style.color} />
              </View>
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.md },
    eyebrow: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 2 },
    monthLabel: { ...typography.screenTitle, color: colors.textPrimary },
    monthNav: { flexDirection: 'row', gap: spacing.sm },
    navButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    weekdayRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.lg },
    weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    grid: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
    weekRow: { flexDirection: 'row' },
    dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
    dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    dayCircleSelected: { backgroundColor: colors.surfaceDark },
    dayCircleHoliday: { backgroundColor: colors.holidayBg },
    dayCircleToday: { borderWidth: 1.5, borderColor: colors.surfaceDark },
    dayText: { fontSize: 15, color: colors.textPrimary },
    dayTextSelected: { color: colors.textOnDark, fontWeight: '600' },
    dayTextHoliday: { color: colors.holiday, fontWeight: '600' },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent, marginTop: 3 },
    scopeSelectorWrapper: { position: 'relative', zIndex: 15, paddingHorizontal: spacing.xl, marginTop: spacing.md },
    scopeSelectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      alignSelf: 'flex-start',
    },
    scopeSelectorText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    scopeDropdown: {
      position: 'absolute',
      top: 44,
      left: spacing.xl,
      minWidth: 180,
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
    divider: { height: 1, backgroundColor: colors.border, marginTop: spacing.lg },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    detailDate: { ...typography.cardTitle, fontSize: 16, color: colors.textPrimary },
    addButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    weatherChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 5 },
    weatherText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
    holidayBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
    holidayText: { fontSize: 14, fontWeight: '500', flex: 1, color: colors.textPrimary },
    holidaySubtext: { fontSize: 12, color: colors.textSecondary },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
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
}
