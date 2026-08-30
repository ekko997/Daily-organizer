import React, { createContext, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, Pressable } from 'react-native';
import { useTheme } from './ThemeContext';

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { colors } = useTheme();

  function showToast(options: ToastOptions) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(options);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timeoutRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
    }, options.duration ?? 3000);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[styles.container, { opacity, backgroundColor: colors.surfaceDark }]}
          pointerEvents="box-none"
        >
          <View style={styles.row}>
            <Text style={[styles.text, { color: colors.textOnDark }]} numberOfLines={2}>{toast.message}</Text>
            {toast.actionLabel && toast.onAction && (
              <Pressable onPress={() => { toast.onAction?.(); setToast(null); }}>
                <Text style={[styles.action, { color: colors.accent }]}>{toast.actionLabel}</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 100,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  text: { flex: 1, fontSize: 14, fontWeight: '500' },
  action: { fontSize: 14, fontWeight: '700' },
});
