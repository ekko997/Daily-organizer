import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../utils/ThemeContext';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';

interface Props {
  onContinue: () => void;
}

export default function WelcomeScreen({ onContinue }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <View style={styles.sun} />
          <View style={styles.horizon} />
        </View>

        <Text style={styles.title}>Steady Days</Text>
        <Text style={styles.subtitle}>
          A steady place for your family's days — appointments, to-dos, and everyone's schedule, together.
        </Text>

        <View style={styles.pointRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.accent} />
          <Text style={styles.pointText}>One calendar for your whole household</Text>
        </View>
        <View style={styles.pointRow}>
          <Ionicons name="checkmark-done-outline" size={18} color={colors.accent} />
          <Text style={styles.pointText}>Shared to-dos, no crossed wires</Text>
        </View>
        <View style={styles.pointRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
          <Text style={styles.pointText}>Your data stays yours</Text>
        </View>
      </View>

      <Pressable style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>Get started</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: 'space-between' },
    content: { flex: 1, justifyContent: 'center' },
    iconCircle: {
      width: 96, height: 96, borderRadius: 24, backgroundColor: colors.surfaceDark,
      alignSelf: 'center', marginBottom: spacing.xxl,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    sun: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.textOnDark, marginTop: -8 },
    horizon: { width: '100%', height: 14, backgroundColor: colors.textOnDark, marginTop: 14 },
    title: { ...typography.screenTitle, fontSize: 28, color: colors.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xxl, lineHeight: 22, paddingHorizontal: spacing.md },
    pointRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, paddingHorizontal: spacing.md },
    pointText: { fontSize: 14, color: colors.textPrimary, flex: 1 },
    button: { backgroundColor: colors.accent, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center' },
    buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  });
}
