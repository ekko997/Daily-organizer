import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { format } from 'date-fns';
import { loadHolidays, PublicHoliday } from '../services/holidayService';
import { spacing, radii, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  countryCode: string;
  region: string;
}

export default function HolidayListModal({ visible, onClose, countryCode, region }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    loadHolidays(countryCode, new Date().getFullYear(), region || undefined).then(map => {
      setHolidays(Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)));
      setLoading(false);
    });
  }, [visible, countryCode, region]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <View style={{ width: 60 }} />
          <Text style={styles.headerTitle}>{new Date().getFullYear()} Holidays</Text>
          <Pressable style={{ width: 60, alignItems: 'flex-end' }} onPress={onClose}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.accent} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
            {holidays.length === 0 ? (
              <Text style={styles.emptyText}>No holidays found for this country.</Text>
            ) : (
              holidays.map(h => (
                <View key={h.date + h.localName} style={styles.row}>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>{format(new Date(h.date), 'MMM d')}</Text>
                  </View>
                  <Text style={styles.holidayName}>{h.localName}</Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
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
    emptyText: { textAlign: 'center', color: colors.textSecondary, fontSize: 14, marginTop: spacing.xl },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, marginBottom: spacing.sm },
    dateBadge: { backgroundColor: colors.holidayBg, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    dateBadgeText: { fontSize: 12, fontWeight: '700', color: colors.holiday },
    holidayName: { flex: 1, fontSize: 14, color: colors.textPrimary },
  });
}
