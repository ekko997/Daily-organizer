import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { reportError } from '../services/errorReporting';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The app hit an unexpected error. Try reopening it — if this keeps happening, let us know.
          </Text>
          <Pressable style={styles.button} onPress={() => this.setState({ hasError: false })}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

// Deliberately plain, hardcoded colors here rather than pulling from the
// theme system — if the crash happened inside theme/context setup itself,
// this screen still needs to render safely on its own.
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF8F4', padding: 24, gap: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#211F1B' },
  subtitle: { fontSize: 14, color: '#8A8378', textAlign: 'center', lineHeight: 20 },
  button: { backgroundColor: '#022515', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
