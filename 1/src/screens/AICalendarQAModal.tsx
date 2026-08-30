import React, { useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { askCalendarQuestion } from '../services/aiService';
import { buildEventsContext } from '../services/eventsContextBuilder';
import { useEvents } from '../utils/EventsContext';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { haptics } from '../utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const EXAMPLES = ["What's on my calendar this weekend?", 'When is my next dentist appointment?', 'Am I free Thursday afternoon?'];

export default function AICalendarQAModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { events } = useEvents();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAsk() {
    if (!question.trim()) return;
    setLoading(true);
    setError('');
    setAnswer('');
    try {
      const context = buildEventsContext(events);
      const result = await askCalendarQuestion(question.trim(), context);
      setAnswer(result);
      haptics.light();
    } catch (err: any) {
      haptics.warning();
      setError(err?.message || "Couldn't answer that — try rephrasing");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setQuestion('');
    setAnswer('');
    setError('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.headerRow}>
            <Pressable onPress={handleClose}><Text style={styles.closeText}>Close</Text></Pressable>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.content}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.accent} style={{ alignSelf: 'center', marginBottom: spacing.md }} />
            <Text style={styles.title}>Ask your calendar</Text>
            <Text style={styles.subtitle}>Ask about your own upcoming events, in plain language.</Text>

            <TextInput
              style={styles.input}
              placeholder="e.g. When's my next dentist appointment?"
              placeholderTextColor={colors.textSecondary}
              value={question}
              onChangeText={setQuestion}
              multiline
              onSubmitEditing={handleAsk}
            />

            <Pressable style={styles.submitButton} onPress={handleAsk} disabled={loading || !question.trim()}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Ask</Text>}
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {answer ? (
              <View style={styles.answerCard}>
                <Text style={styles.answerText}>{answer}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.examplesLabel}>Try something like:</Text>
                {EXAMPLES.map(ex => (
                  <Pressable key={ex} onPress={() => setQuestion(ex)}>
                    <Text style={styles.exampleText}>"{ex}"</Text>
                  </Pressable>
                ))}
              </>
            )}
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
    submitButton: { backgroundColor: colors.accent, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
    submitText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    error: { color: colors.holiday, fontSize: 13, marginTop: spacing.md, textAlign: 'center' },
    answerCard: { backgroundColor: colors.surfaceDark, borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.xl },
    answerText: { fontSize: 16, color: colors.textOnDark, lineHeight: 23 },
    examplesLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.xxl, marginBottom: spacing.sm },
    exampleText: { fontSize: 13, color: colors.accent, marginBottom: spacing.sm },
  });
}
