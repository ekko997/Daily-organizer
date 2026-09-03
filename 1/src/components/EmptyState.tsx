import React from 'react';
import { View, Text, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  fill?: boolean; // if true, centers within all available vertical space
  // Optional mascot illustration shown instead of the generic icon circle —
  // used for the specific empty states that have a matching owl pose.
  mascotImage?: ImageSourcePropType;
}

export default function EmptyState({ icon, title, subtitle, fill, mascotImage }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, fill && { flex: 1, justifyContent: 'center' }]}>
      {mascotImage ? (
        <Image source={mascotImage} style={styles.mascotImage} resizeMode="contain" />
      ) : (
        <View style={[styles.iconCircle, { backgroundColor: colors.accent + '18' }]}>
          <Ionicons name={icon as any} size={28} color={colors.accent} />
        </View>
      )}
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.xxl * 1.2, gap: spacing.xs },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  mascotImage: { width: 330, height: 330, marginBottom: spacing.sm },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 30, marginTop: 2 },
});
