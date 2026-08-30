import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { startOfYear, endOfYear, format } from 'date-fns';
import { CloudEvent } from '../services/cloudEventService';
import { occurrencesInRange } from '../services/recurrenceEngine';
import { CATEGORY_STYLES, EventCategory } from '../models/Event';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  events: CloudEvent[];
}

export default function YearRecapModal({ visible, onClose, events }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const year = new Date().getFullYear();

  const stats = useMemo(() => {
    const start = startOfYear(new Date());
    const end = endOfYear(new Date());
    const categoryCounts: Partial<Record<EventCategory, number>> = {};
    const monthCounts = new Array(12).fill(0);
    let total = 0;
    let familyCount = 0;
    let personalCount = 0;

    for (const event of events) {
      const occurrences = occurrencesInRange(event, start, end);
      total += occurrences.length;
      categoryCounts[event.category] = (categoryCounts[event.category] || 0) + occurrences.length;
      if (event.scope === 'family') familyCount += occurrences.length;
      else personalCount += occurrences.length;
      for (const occ of occurrences) monthCounts[occ.getMonth()] += 1;
    }

    const busiestMonthIndex = monthCounts.indexOf(Math.max(...monthCounts));
    const busiestMonth = total > 0 ? format(new Date(year, busiestMonthIndex, 1), 'MMMM') : null;
    const topCategory = (Object.entries(categoryCounts) as [EventCategory, number][])
      .sort((a, b) => b[1] - a[1])[0];

    return { total, familyCount, personalCount, busiestMonth, topCategory, categoryCounts };
  }, [events, year]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <View style={{ width: 60 }} />
          <Text style={styles.headerTitle}>{year} in Review</Text>
          <Pressable style={{ width: 60, alignItems: 'flex-end' }} onPress={onClose}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatNumber}>{stats.total}</Text>
            <Text style={styles.bigStatLabel}>events this year</Text>
          </View>

          {stats.total === 0 ? (
            <Text style={styles.emptyText}>Add some events to see your year in review.</Text>
          ) : (
            <>
              <View style={styles.row}>
                <View style={styles.smallCard}>
                  <Text style={styles.smallCardNumber}>{stats.personalCount}</Text>
                  <Text style={styles.smallCardLabel}>Personal</Text>
                </View>
                <View style={styles.smallCard}>
                  <Text style={styles.smallCardNumber}>{stats.familyCount}</Text>
                  <Text style={styles.smallCardLabel}>Family</Text>
                </View>
              </View>

              {stats.busiestMonth && (
                <View style={styles.insightRow}>
                  <Ionicons name="calendar" size={18} color={colors.accent} />
                  <Text style={styles.insightText}>Your busiest month was <Text style={styles.insightBold}>{stats.busiestMonth}</Text></Text>
                </View>
              )}

              {stats.topCategory && (
                <View style={styles.insightRow}>
                  <Ionicons name={CATEGORY_STYLES[stats.topCategory[0]].icon as any} size={18} color={CATEGORY_STYLES[stats.topCategory[0]].color} />
                  <Text style={styles.insightText}>
                    Most common: <Text style={styles.insightBold}>{CATEGORY_STYLES[stats.topCategory[0]].label}</Text> ({stats.topCategory[1]} events)
                  </Text>
                </View>
              )}

              <Text style={styles.sectionLabel}>By category</Text>
              {(Object.entries(stats.categoryCounts) as [EventCategory, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <View key={cat} style={styles.categoryRow}>
                    <Ionicons name={CATEGORY_STYLES[cat].icon as any} size={16} color={CATEGORY_STYLES[cat].color} />
                    <Text style={styles.categoryLabel}>{CATEGORY_STYLES[cat].label}</Text>
                    <Text style={styles.categoryCount} maxFontSizeMultiplier={1.3}>{count}</Text>
                  </View>
                ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl },
    headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    closeText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
    bigStatCard: { backgroundColor: colors.surfaceDark, borderRadius: radii.lg, padding: spacing.xxl, alignItems: 'center', marginBottom: spacing.lg },
    bigStatNumber: { fontSize: 48, fontWeight: '800', color: colors.textOnDark },
    bigStatLabel: { fontSize: 14, color: colors.textOnDarkMuted, marginTop: 4 },
    emptyText: { textAlign: 'center', color: colors.textSecondary, fontSize: 14, marginTop: spacing.xl },
    row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    smallCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg, alignItems: 'center' },
    smallCardNumber: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
    smallCardLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    insightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, marginBottom: spacing.sm },
    insightText: { fontSize: 13, color: colors.textPrimary, flex: 1 },
    insightBold: { fontWeight: '700' },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
    categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    categoryLabel: { flex: 1, fontSize: 14, color: colors.textPrimary },
    categoryCount: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  });
}
