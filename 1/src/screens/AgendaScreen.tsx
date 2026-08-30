import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, SafeAreaView, TextInput, RefreshControl, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addYears, startOfToday, isToday, isTomorrow } from 'date-fns';
import { useEvents } from '../utils/EventsContext';
import { occurrencesInRange } from '../services/recurrenceEngine';
import { CATEGORY_STYLES } from '../models/Event';
import { spacing, radii, typography, cardShadow, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { colorForMember, memberDisplayName } from '../utils/memberColor';
import { useFamily } from '../utils/FamilyContext';
import AddEditEventModal from './AddEditEventModal';
import AICalendarQAModal from './AICalendarQAModal';
import ScreenTransition from '../components/ScreenTransition';
import EmptyState from '../components/EmptyState';
import { haptics } from '../utils/haptics';
import { withOccurrenceOverride } from '../utils/dateMath';

export default function AgendaScreen() {
  const { events } = useEvents();
  const { members } = useFamily();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [qaModalVisible, setQaModalVisible] = useState(false);

  function memberName(uid: string): string {
    return memberDisplayName(members.find(x => x.uid === uid));
  }

  function openLocation(location: string) {
    Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(location)}`);
  }

  function openMeetingLink(link: string) {
    const url = link.startsWith('http') ? link : `https://${link}`;
    Linking.openURL(url);
  }

  // Events already sync live via Firestore, so there's nothing to actually
  // re-fetch — this just gives the expected tactile confirmation that
  // everything's current when someone pulls down.
  const onRefresh = useCallback(() => {
    haptics.light();
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

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

    const query = searchQuery.trim().toLowerCase();

    return Array.from(grouped.entries())
      .map(([key, items]) => ({
        title: isToday(items[0].date) ? 'Today' : isTomorrow(items[0].date) ? 'Tomorrow' : format(items[0].date, 'EEEE, MMM d'),
        data: items
          .map(item => ({ ...withOccurrenceOverride(events.find(e => e.id === item.eventId)!, item.date), occurrenceDate: item.date }))
          .filter(item => !query || item.title.toLowerCase().includes(query)),
      }))
      .filter(section => section.data.length > 0);
  }, [events, searchQuery]);

  const resultCount = useMemo(() => sections.reduce((sum, s) => sum + s.data.length, 0), [sections]);

  const upcomingIn30Days = useMemo(() => {
    const thirtyDaysOut = addYears(startOfToday(), 0);
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
    let count = 0;
    for (const section of sections) {
      count += section.data.filter((item: any) => item.occurrenceDate <= thirtyDaysOut).length;
    }
    return count;
  }, [sections]);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenTransition>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Agenda</Text>
        <Pressable style={styles.askButton} onPress={() => setQaModalVisible(true)} accessibilityLabel="Ask your calendar" accessibilityRole="button">
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.accent} />
        </Pressable>
      </View>

      {sections.length > 0 && !searchQuery && (
        <View style={styles.statCard}>
          <View>
            <Text style={styles.statNumber}>{upcomingIn30Days}</Text>
            <Text style={styles.statLabel}>in the next 30 days</Text>
          </View>
          <Ionicons name="calendar" size={28} color={colors.textOnDarkMuted} />
        </View>
      )}

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events"
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {searchQuery.trim().length > 0 && (
        <Text style={styles.resultCount}>{resultCount} result{resultCount === 1 ? '' : 's'}</Text>
      )}

      {sections.length === 0 ? (
        <EmptyState
          fill
          icon={searchQuery ? 'search' : 'calendar-outline'}
          title={searchQuery ? 'No matching events' : 'No events yet'}
          subtitle={searchQuery ? undefined : 'Add one from the Calendar tab'}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item: any, index) => `${item.id}-${index}`}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderDot} />
              <Text style={styles.sectionHeader}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }: any) => {
            const style = CATEGORY_STYLES[item.category];
            return (
              <Pressable
                style={({ pressed }) => [styles.row, { borderLeftColor: style.color }, pressed && { opacity: 0.6 }]}
                onPress={() => { setEditingEventId(item.id); setEditingOccurrenceDate(item.occurrenceDate); setModalVisible(true); }}
              >
                <View style={[styles.categoryBadge, { backgroundColor: style.color + '22' }]}>
                  <Ionicons name={style.icon as any} size={14} color={style.color} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    {item.assignedTo && (
                      <View style={[styles.assignedBadge, { backgroundColor: colorForMember(item.assignedTo) + '22' }]}>
                        <View style={[styles.assignedDot, { backgroundColor: colorForMember(item.assignedTo) }]} />
                        <Text style={[styles.assignedText, { color: colorForMember(item.assignedTo) }]} maxFontSizeMultiplier={1.3}>{memberName(item.assignedTo)}</Text>
                      </View>
                    )}
                  </View>
                  {!item.isAllDay && <Text style={styles.rowTime}>{format(new Date(item.date), 'h:mm a')}</Text>}
                  {(item.location || item.meetingLink) && (
                    <View style={styles.metaRow}>
                      {item.location && (
                        <Pressable style={styles.metaChip} onPress={() => openLocation(item.location)}>
                          <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                          <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
                        </Pressable>
                      )}
                      {item.meetingLink && (
                        <Pressable style={styles.metaChip} onPress={() => openMeetingLink(item.meetingLink)}>
                          <Ionicons name="videocam-outline" size={12} color={colors.textSecondary} />
                          <Text style={styles.metaText}>Join</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
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
        occurrenceDate={editingOccurrenceDate}
      />
      <AICalendarQAModal visible={qaModalVisible} onClose={() => setQaModalVisible(false)} />
      </ScreenTransition>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { ...typography.screenTitle, color: colors.textPrimary },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
    askButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    statCard: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: colors.surfaceDark, borderRadius: radii.lg,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
      marginHorizontal: spacing.xl, marginBottom: spacing.lg,
      ...cardShadow,
    },
    statNumber: { fontSize: 28, fontWeight: '800', fontFamily: 'Manrope_800ExtraBold', color: colors.textOnDark },
    statLabel: { fontSize: 12, color: colors.textOnDarkMuted, marginTop: 2 },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
    resultCount: { fontSize: 12, color: colors.textSecondary, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.sm },
    sectionHeaderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
    sectionHeader: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.sm, borderLeftWidth: 4, padding: spacing.md, marginBottom: spacing.xs, ...cardShadow },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    categoryBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { ...typography.body, color: colors.textPrimary },
    rowTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    assignedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
    assignedDot: { width: 6, height: 6, borderRadius: 3 },
    assignedText: { fontSize: 10, fontWeight: '700' },
    metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 160 },
    metaText: { fontSize: 11, color: colors.textSecondary },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    emptyText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    emptySubtext: { fontSize: 13, color: colors.textSecondary },
  });
}
