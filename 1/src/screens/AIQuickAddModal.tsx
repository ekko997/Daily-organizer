import React, { useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parseEventText, ParsedEventDraft } from '../services/aiService';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { useToast } from '../utils/ToastContext';
import { haptics } from '../utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  onParsed: (draft: { title: string; date: Date; isAllDay: boolean; category: ParsedEventDraft['category']; location: string | null }) => void;
}

const EXAMPLES = ['Dentist next Tuesday 3pm', 'Team meeting tomorrow 10am', "Mom's birthday March 12"];

export default function AIQuickAddModal({ visible, onClose, onParsed }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const parsed = await parseEventText(text.trim());
      haptics.success();
      onParsed({
        title: parsed.title,
        date: new Date(parsed.date),
        isAllDay: parsed.isAllDay,
        category: parsed.category,
        location: parsed.location,
      });
      setText('');
      onClose();
      if (parsed.confirmation) {
        showToast({ message: parsed.confirmation, duration: 4000 });
      }
    } catch (err: any) {
      haptics.warning();
      setError(err?.message || "Couldn't understand that — try rephrasing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.headerRow}>
            <Pressable onPress={onClose}><Text style={styles.closeText}>Cancel</Text></Pressable>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.content}>
            <Ionicons name="sparkles" size={32} color={colors.accent} style={{ alignSelf: 'center', marginBottom: spacing.md }} />
            <Text style={styles.title}>Add an event by typing</Text>
            <Text style={styles.subtitle}>Describe it naturally — we'll fill in the details for you to review.</Text>

            <TextInput
              style={styles.input}
              placeholder="e.g. Dentist next Tuesday 3pm"
              placeholderTextColor={colors.textSecondary}
              value={text}
              onChangeText={setText}
              autoFocus
              multiline
              onSubmitEditing={handleSubmit}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading || !text.trim()}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Parse it</Text>}
            </Pressable>

            <Text style={styles.examplesLabel}>Try something like:</Text>
            {EXAMPLES.map(ex => (
              <Pressable key={ex} onPress={() => setText(ex)}>
                <Text style={styles.exampleText}>"{ex}"</Text>
              </Pressable>
            ))}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
    closeText: { color: colors.textSecondary, fontSize: 15 },
    content: { flex: 1, padding: spacing.xl, paddingTop: spacing.xxl },
    title: { ...typography.screenTitle, fontSize: 20, color: colors.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: spacing.xl, lineHeight: 19 },
    input: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, fontSize: 16, color: colors.textPrimary, minHeight: 70, borderWidth: 1, borderColor: colors.border, textAlignVertical: 'top' },
    error: { color: colors.holiday, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
    submitButton: { backgroundColor: colors.accent, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
    submitText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    examplesLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.xxl, marginBottom: spacing.sm },
    exampleText: { fontSize: 13, color: colors.accent, marginBottom: spacing.sm },
  });
}
