import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useFamily } from '../utils/FamilyContext';
import { useAuth } from '../utils/AuthContext';
import { useTheme } from '../utils/ThemeContext';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { capitalizeFirst } from '../utils/textUtils';

export default function FamilySetupScreen() {
  const { createFamily, joinFamily } = useFamily();
  const { signOut } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!familyName.trim()) { setError('Give your family calendar a name.'); return; }
    setLoading(true);
    setError('');
    try {
      await createFamily(familyName.trim());
    } catch {
      setError('Could not create family. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) { setError('Enter an invite code.'); return; }
    setLoading(true);
    setError('');
    try {
      const success = await joinFamily(inviteCode.trim());
      if (!success) setError("That code doesn't match any family.");
    } catch {
      setError('Could not join family. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          {mode === 'choose' && (
            <>
              <Text style={styles.title}>Set up your family calendar</Text>
              <Text style={styles.subtitle}>Create a new one, or join with a code someone shared with you.</Text>

              <Pressable style={styles.optionButton} onPress={() => setMode('create')}>
                <Text style={styles.optionButtonText}>Create a family calendar</Text>
              </Pressable>
              <Pressable style={[styles.optionButton, styles.optionButtonSecondary]} onPress={() => setMode('join')}>
                <Text style={[styles.optionButtonText, { color: colors.accent }]}>Join with invite code</Text>
              </Pressable>

              <Pressable onPress={signOut} style={{ marginTop: spacing.xxl }}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </>
          )}

          {mode === 'create' && (
            <>
              <Text style={styles.title}>Name your family calendar</Text>
              <Text style={styles.subtitle}>E.g. "The Smiths" — you can change this later.</Text>
              <TextInput
                style={styles.input}
                placeholder="The Smiths"
                placeholderTextColor={colors.textSecondary}
                value={familyName}
                onChangeText={text => setFamilyName(capitalizeFirst(text))}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable style={styles.submitButton} onPress={handleCreate} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Create</Text>}
              </Pressable>
              <Pressable onPress={() => setMode('choose')}><Text style={styles.backText}>Back</Text></Pressable>
            </>
          )}

          {mode === 'join' && (
            <>
              <Text style={styles.title}>Enter invite code</Text>
              <Text style={styles.subtitle}>Ask whoever set up the family calendar for their 6-character code.</Text>
              <TextInput
                style={styles.input}
                placeholder="ABC123"
                placeholderTextColor={colors.textSecondary}
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable style={styles.submitButton} onPress={handleJoin} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Join</Text>}
              </Pressable>
              <Pressable onPress={() => setMode('choose')}><Text style={styles.backText}>Back</Text></Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
    title: { ...typography.screenTitle, fontSize: 22, color: colors.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: spacing.xxl, lineHeight: 20 },
    optionButton: { backgroundColor: colors.accent, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
    optionButtonSecondary: { backgroundColor: colors.surface },
    optionButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    input: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, marginBottom: spacing.md, color: colors.textPrimary },
    error: { color: colors.holiday, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' },
    submitButton: { backgroundColor: colors.accent, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
    submitText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    backText: { textAlign: 'center', marginTop: spacing.xl, fontSize: 13, color: colors.textSecondary },
    signOutText: { textAlign: 'center', fontSize: 13, color: colors.holiday },
  });
}
