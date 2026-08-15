import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import { useTheme } from '../utils/ThemeContext';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (e: any) {
      setError(friendlyError(e?.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          <Text style={styles.title}>Daily Organizer</Text>
          <Text style={styles.subtitle}>{mode === 'signin' ? 'Sign in to continue' : 'Create your account'}</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : (
              <Text style={styles.submitText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            <Text style={styles.switchText}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={{ color: colors.accent, fontWeight: '600' }}>
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function friendlyError(code?: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'That email address looks invalid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/email-already-in-use': return 'An account with that email already exists.';
    case 'auth/weak-password': return 'Password should be at least 6 characters.';
    default: return 'Something went wrong. Please try again.';
  }
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
    title: { ...typography.screenTitle, color: colors.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: spacing.xxl },
    input: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, marginBottom: spacing.md, color: colors.textPrimary },
    error: { color: colors.holiday, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' },
    submitButton: { backgroundColor: colors.accent, borderRadius: radii.sm, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
    submitText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    switchText: { textAlign: 'center', marginTop: spacing.xl, fontSize: 13, color: colors.textSecondary },
  });
}
