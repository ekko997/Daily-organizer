import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, SafeAreaView, Linking, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, addWeeks, isSameMonth, endOfDay, startOfWeek, addDays } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEvents } from '../utils/EventsContext';
import { gridDates, isSameDay, dayStart, isoDateKey } from '../utils/dateUtils';
import { occurrencesInRange } from '../services/recurrenceEngine';
import { loadHolidays, PublicHoliday } from '../services/holidayService';
import { loadForecast, weatherIcon, DailyForecast } from '../services/weatherService';
import { CATEGORY_STYLES } from '../models/Event';
import { spacing, radii, typography, cardShadow, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { useFamily } from '../utils/FamilyContext';
import { colorForMember } from '../utils/memberColor';
import { withOccurrenceOverride } from '../utils/dateMath';
import { haptics } from '../utils/haptics';
import AddEditEventModal from './AddEditEventModal';
import ScreenTransition from '../components/ScreenTransition';
import EmptyState from '../components/EmptyState';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type ViewMode = 'month' | 'week' | 'day';

// Hour range shown in Day view — full 24h isn't usually necessary and just
// adds scrolling; this range covers the vast majority of real schedules.
const DAY_VIEW_START_HOUR = 6;
const DAY_VIEW_END_HOUR = 23;

export default function CalendarScreen() {
  const { events, countryCode, region, latitude, longitude, activeScope, setActiveScope } = useEvents();
  const { family, members } = useFamily();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [displayedMonth, setDisplayedMonth] = useState(new Date());
  const [displayedWeekStart, setDisplayedWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [holidays, setHolidays] = useState<Map<string, PublicHoliday>>(new Map());
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Remember the last Month/Week choice between app sessions.
  useEffect(() => {
    AsyncStorage.getItem('calendar_view_mode_v1').then(saved => {
      if (saved === 'month' || saved === 'week' || saved === 'day') setViewMode(saved);
    });
  }, []);

  function changeViewMode(next: ViewMode) {
    setViewMode(next);
    AsyncStorage.setItem('calendar_view_mode_v1', next);
    if (next === 'week') setDisplayedWeekStart(startOfWeek(selectedDate, { weekStartsOn: 1 }));
  }

  function jumpToToday() {
    haptics.light();
    const now = new Date();
    setSelectedDate(now);
    setDisplayedMonth(now);
    setDisplayedWeekStart(startOfWeek(now, { weekStartsOn: 1 }));
  }

  function onRefresh() {
    haptics.light();
    setRefreshing(true);
    setLoadingExtras(true);
    Promise.all([
      loadHolidays(countryCode, holidayYear, region || undefined).then(setHolidays),
      latitude != null && longitude != null ? loadForecast(latitude, longitude).then(setForecast) : Promise.resolve(),
    ]).finally(() => {
      setLoadingExtras(false);
      setRefreshing(false);
    });
  }

  const holidayYear = viewMode === 'month' ? displayedMonth.getFullYear() : displayedWeekStart.getFullYear();

  useEffect(() => {
    loadHolidays(countryCode, holidayYear, region || undefined).then(setHolidays);
  }, [countryCode, region, holidayYear]);

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

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(displayedWeekStart, i)), [displayedWeekStart]);

  function eventsOn(date: Date) {
    const start = dayStart(date);
    const end = endOfDay(date);
    return events.filter(e => e.scope === activeScope && occurrencesInRange(e, start, end).length > 0);
  }

  const selectedDayEvents = useMemo(
    () => eventsOn(selectedDate)
      .map(e => withOccurrenceOverride(e, selectedDate))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events, selectedDate]
  );

  const hourSlots = useMemo(
    () => Array.from({ length: DAY_VIEW_END_HOUR - DAY_VIEW_START_HOUR + 1 }, (_, i) => DAY_VIEW_START_HOUR + i),
    []
  );
  const timedEventsForSelectedDate = useMemo(() => selectedDayEvents.filter(e => !e.isAllDay), [selectedDayEvents]);
  const allDayEventsForSelectedDate = useMemo(() => selectedDayEvents.filter(e => e.isAllDay), [selectedDayEvents]);
  const selectedHoliday = holidays.get(isoDateKey(selectedDate));

  function memberName(uid: string): string {
    const m = members.find(x => x.uid === uid);
    return m ? m.email.split('@')[0] : 'Someone';
  }

  function openLocation(location: string) {
    Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(location)}`);
  }

  function openMeetingLink(link: string) {
    const url = link.startsWith('http') ? link : `https://${link}`;
    Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenTransition>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SET UP APPOINTMENTS</Text>
          <Text style={styles.monthLabel}>
            {viewMode === 'month' ? format(displayedMonth, 'MMMM yyyy') : `${format(displayedWeekStart, 'MMM d')} – ${format(addDays(displayedWeekStart, 6), 'MMM d')}`}
          </Text>
        </View>
        <View style={styles.monthNav}>
          <Pressable
            style={styles.navButton}
            onPress={() => viewMode === 'month' ? setDisplayedMonth(addMonths(displayedMonth, -1)) : setDisplayedWeekStart(addWeeks(displayedWeekStart, -1))}
          >
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            style={styles.navButton}
            onPress={() => viewMode === 'month' ? setDisplayedMonth(addMonths(displayedMonth, 1)) : setDisplayedWeekStart(addWeeks(displayedWeekStart, 1))}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.viewToggleRow}>
        <Pressable
          style={[styles.viewToggleButton, viewMode === 'month' && styles.viewToggleButtonActive]}
          onPress={() => changeViewMode('month')}
          accessibilityLabel="Month view"
          accessibilityRole="button"
        >
          <Text style={[styles.viewToggleText, viewMode === 'month' && styles.viewToggleTextActive]} maxFontSizeMultiplier={1.3}>Month</Text>
        </Pressable>
        <Pressable
          style={[styles.viewToggleButton, viewMode === 'week' && styles.viewToggleButtonActive]}
          onPress={() => changeViewMode('week')}
          accessibilityLabel="Week view"
          accessibilityRole="button"
        >
          <Text style={[styles.viewToggleText, viewMode === 'week' && styles.viewToggleTextActive]} maxFontSizeMultiplier={1.3}>Week</Text>
        </Pressable>
        <Pressable
          style={[styles.viewToggleButton, viewMode === 'day' && styles.viewToggleButtonActive]}
          onPress={() => changeViewMode('day')}
          accessibilityLabel="Day view"
          accessibilityRole="button"
        >
          <Text style={[styles.viewToggleText, viewMode === 'day' && styles.viewToggleTextActive]} maxFontSizeMultiplier={1.3}>Day</Text>
        </Pressable>
        <Pressable style={styles.todayJumpButton} onPress={jumpToToday} accessibilityLabel="Jump to today" accessibilityRole="button">
          <Text style={styles.todayJumpText} maxFontSizeMultiplier={1.3}>Today</Text>
        </Pressable>
        {loadingExtras && <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />}
      </View>

      {viewMode === 'day' && (
        <View style={styles.dayNavRow}>
          <Pressable style={styles.navButton} onPress={() => setSelectedDate(addDays(selectedDate, -1))} accessibilityLabel="Previous day" accessibilityRole="button">
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.dayNavLabel}>{format(selectedDate, 'EEEE, MMM d')}</Text>
          <Pressable style={styles.navButton} onPress={() => setSelectedDate(addDays(selectedDate, 1))} accessibilityLabel="Next day" accessibilityRole="button">
            <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
      )}

      {viewMode === 'month' && (
        <>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <Text key={i} style={styles.weekdayLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
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
                    <Pressable key={i} style={({ pressed }) => [styles.dayCell, pressed && { opacity: 0.5 }]} onPress={() => setSelectedDate(date)}>
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
        </>
      )}

      {viewMode === 'week' && (
        <View style={styles.weekStrip}>
          {weekDays.map((date, i) => {
            const holiday = holidays.get(isoDateKey(date));
            const dayEventCount = eventsOn(date).length;
            const selected = isSameDay(date, selectedDate);
            const today = isSameDay(date, new Date());

            return (
              <Pressable key={i} style={({ pressed }) => [styles.weekDayCard, selected && styles.weekDayCardSelected, pressed && { opacity: 0.7 }]} onPress={() => setSelectedDate(date)}>
                <Text style={[styles.weekDayLabel, selected && styles.weekDayLabelSelected]} maxFontSizeMultiplier={1.3}>{WEEKDAY_LABELS[i]}</Text>
                <View style={[
                  styles.weekDayNumber,
                  today && !selected && styles.dayCircleToday,
                  holiday && !selected && styles.dayCircleHoliday,
                ]}>
                  <Text style={[styles.dayText, selected && styles.dayTextSelected, !selected && holiday && styles.dayTextHoliday]}>
                    {format(date, 'd')}
                  </Text>
                </View>
                {dayEventCount > 0 && <Text style={[styles.weekDayCount, selected && styles.weekDayLabelSelected]}>{dayEventCount}</Text>}
              </Pressable>
            );
          })}
        </View>
      )}

      {viewMode === 'day' && (
        <ScrollView style={styles.hourGrid} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {allDayEventsForSelectedDate.length > 0 && (
            <View style={styles.allDaySection}>
              {allDayEventsForSelectedDate.map(item => {
                const style = CATEGORY_STYLES[item.category];
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.allDayChip, { backgroundColor: style.color + '22' }]}
                    onPress={() => { setEditingEventId(item.id); setModalVisible(true); }}
                  >
                    <Ionicons name={style.icon as any} size={12} color={style.color} />
                    <Text style={[styles.allDayChipText, { color: style.color }]} numberOfLines={1}>{item.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {hourSlots.map(hour => {
            const hourEvents = timedEventsForSelectedDate.filter(item => new Date(item.date).getHours() === hour);
            return (
              <View key={hour} style={styles.hourRow}>
                <Text style={styles.hourLabel}>{format(new Date(2000, 0, 1, hour), 'h a')}</Text>
                <View style={styles.hourContent}>
                  {hourEvents.length === 0 ? (
                    <View style={styles.hourLine} />
                  ) : (
                    hourEvents.map(item => {
                      const style = CATEGORY_STYLES[item.category];
                      return (
                        <Pressable
                          key={item.id}
                          style={[styles.hourEventChip, { borderLeftColor: style.color }]}
                          onPress={() => { setEditingEventId(item.id); setModalVisible(true); }}
                        >
                          <Text style={styles.hourEventTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.hourEventTime}>{format(new Date(item.date), 'h:mm a')}</Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {family ? (
        <View style={styles.scopeSelectorWrapper}>
          <Pressable style={styles.scopeSelectorButton} onPress={() => setScopeDropdownOpen(!scopeDropdownOpen)} accessibilityLabel="Switch calendar" accessibilityRole="button">
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
      ) : null}

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
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressedShrink]}
            accessibilityLabel="Add event"
            accessibilityRole="button"
            onPress={() => { setEditingEventId(null); setModalVisible(true); }}
          >
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <EmptyState icon="calendar-clear-outline" title="Nothing scheduled" subtitle="Tap + to add something for this day" />
        }
        renderItem={({ item }) => {
          const style = CATEGORY_STYLES[item.category];
          return (
            <Pressable
              style={({ pressed }) => [styles.eventRow, { borderLeftColor: style.color }, pressed && styles.pressedDim]}
              onPress={() => { setEditingEventId(item.id); setModalVisible(true); }}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  {item.assignedTo && (
                    <View style={[styles.assignedBadge, { backgroundColor: colorForMember(item.assignedTo) + '22' }]}>
                      <View style={[styles.assignedDot, { backgroundColor: colorForMember(item.assignedTo) }]} />
                      <Text style={[styles.assignedText, { color: colorForMember(item.assignedTo) }]} maxFontSizeMultiplier={1.3}>{memberName(item.assignedTo)}</Text>
                    </View>
                  )}
                </View>
                {!item.isAllDay && (
                  <Text style={styles.eventTime}>{format(new Date(item.date), 'h:mm a')}</Text>
                )}
                {(item.location || item.meetingLink) && (
                  <View style={styles.metaRow}>
                    {item.location && (
                      <Pressable style={styles.metaChip} onPress={() => openLocation(item.location!)}>
                        <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
                      </Pressable>
                    )}
                    {item.meetingLink && (
                      <Pressable style={styles.metaChip} onPress={() => openMeetingLink(item.meetingLink!)}>
                        <Ionicons name="videocam-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.metaText}>Join</Text>
                      </Pressable>
                    )}
                  </View>
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
        occurrenceDate={selectedDate}
      />
      </ScreenTransition>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.md },
    eyebrow: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 2 },
    monthLabel: { ...typography.screenTitle, fontSize: 22, color: colors.textPrimary },
    monthNav: { flexDirection: 'row', gap: spacing.sm },
    navButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    viewToggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl, marginTop: spacing.md },
    todayJumpButton: { marginLeft: 'auto', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
    todayJumpText: { fontSize: 12, fontWeight: '600', color: colors.accent },
    viewToggleButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.surface },
    viewToggleButtonActive: { backgroundColor: colors.surfaceDark },
    viewToggleText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    viewToggleTextActive: { color: colors.textOnDark },
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
    weekStrip: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.lg, gap: 4 },
    dayNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, marginTop: spacing.md },
    dayNavLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    hourGrid: { paddingHorizontal: spacing.xl, marginTop: spacing.md, maxHeight: 380 },
    allDaySection: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    allDayChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 5, maxWidth: 160 },
    allDayChipText: { fontSize: 11, fontWeight: '600' },
    hourRow: { flexDirection: 'row', minHeight: 40 },
    hourLabel: { width: 52, fontSize: 11, color: colors.textSecondary, paddingTop: 2 },
    hourContent: { flex: 1, justifyContent: 'center', paddingBottom: spacing.xs },
    hourLine: { height: 1, backgroundColor: colors.border },
    hourEventChip: { backgroundColor: colors.surface, borderLeftWidth: 3, borderRadius: radii.sm, padding: spacing.sm, marginBottom: 4 },
    hourEventTitle: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
    hourEventTime: { fontSize: 10, color: colors.textSecondary, marginTop: 1 },
    weekDayCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.md, gap: 4 },
    weekDayCardSelected: { backgroundColor: colors.surfaceDark },
    weekDayLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    weekDayLabelSelected: { color: colors.textOnDark },
    weekDayNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    weekDayCount: { fontSize: 10, color: colors.textSecondary },
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
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderLeftWidth: 4,
      borderRadius: radii.sm,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...cardShadow,
    },
    pressedShrink: { transform: [{ scale: 0.94 }], opacity: 0.85 },
    pressedDim: { opacity: 0.6 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    eventTitle: { ...typography.body, color: colors.textPrimary },
    eventTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    assignedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
    assignedDot: { width: 6, height: 6, borderRadius: 3 },
    assignedText: { fontSize: 10, fontWeight: '700' },
    metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 140 },
    metaText: { fontSize: 11, color: colors.textSecondary },
    categoryBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  });
}
