import React, { useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { parseEventText, parseEventPhoto, ParsedEventDraft } from '../services/aiService';
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
  const [pickedPhotoUri, setPickedPhotoUri] = useState<string | null>(null);

  function handleParsedResult(parsed: ParsedEventDraft) {
    haptics.success();
    onParsed({
      title: parsed.title,
      date: new Date(parsed.date),
      isAllDay: parsed.isAllDay,
      category: parsed.category,
      location: parsed.location,
    });
    setText('');
    setPickedPhotoUri(null);
    onClose();
    if (parsed.confirmation) {
      showToast({ message: parsed.confirmation, duration: 4000 });
    }
  }

  async function handleSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const parsed = await parseEventText(text.trim());
      handleParsedResult(parsed);
    } catch (err: any) {
      haptics.warning();
      setError(err?.message || "Couldn't understand that — try rephrasing");
    } finally {
      setLoading(false);
    }
  }

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ message: 'Photo access is needed for this' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5, // keep the upload small — this is for text extraction, not display
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setPickedPhotoUri(asset.uri);
    setError('');
    setLoading(true);
    try {
      const mimeType = asset.mimeType || 'image/jpeg';
      const parsed = await parseEventPhoto(asset.base64!, mimeType);
      handleParsedResult(parsed);
    } catch (err: any) {
      haptics.warning();
      setError(err?.message || "Couldn't read the event details from that photo — try a clearer shot");
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
            <Text style={styles.title}>Add an event</Text>
            <Text style={styles.subtitle}>Describe it naturally, or snap a photo of a flyer or invite — we'll fill in the details for you to review.</Text>

            {pickedPhotoUri && (
              <Image source={{ uri: pickedPhotoUri }} style={styles.photoPreview} />
            )}

            <TextInput
              style={styles.input}
              placeholder="e.g. Dentist next Tuesday 3pm"
              placeholderTextColor={colors.textSecondary}
              value={text}
              onChangeText={setText}
              multiline
              onSubmitEditing={handleSubmit}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading || !text.trim()}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Parse it</Text>}
            </Pressable>

            <Pressable style={styles.photoButton} onPress={handlePickPhoto} disabled={loading}>
              <Ionicons name="image-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.photoButtonText}>Or use a photo instead</Text>
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
    photoPreview: { width: '100%', height: 140, borderRadius: radii.sm, marginBottom: spacing.md },
    input: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, fontSize: 16, color: colors.textPrimary, minHeight: 70, borderWidth: 1, borderColor: colors.border, textAlignVertical: 'top' },
    error: { color: colors.holiday, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
    submitButton: { backgroundColor: colors.accent, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
    submitText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    photoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, marginTop: spacing.sm },
    photoButtonText: { fontSize: 13, color: colors.textSecondary },
    examplesLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.xxl, marginBottom: spacing.sm },
    exampleText: { fontSize: 13, color: colors.accent, marginBottom: spacing.sm },
  });
}
