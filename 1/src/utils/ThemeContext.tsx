import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme, Animated, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getColors, ThemeColors, ThemeMode } from './theme';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colors: ThemeColors;
  mode: ThemeMode;              // the resolved mode actually in use
  preference: ThemePreference;  // what the user picked (may be 'system')
  setPreference: (pref: ThemePreference) => void;
}

const STORAGE_KEY = 'theme_preference_v1';

const ThemeContext = createContext<ThemeContextValue>({
  colors: getColors('light'),
  mode: 'light',
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setPreferenceState(saved);
      }
    });
  }, []);

  function setPreference(pref: ThemePreference) {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref);
  }

  const mode: ThemeMode = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const colors = useMemo(() => getColors(mode), [mode]);

  // Crossfade mask: whenever the resolved mode actually changes, briefly
  // overlay a solid layer in the new background color and fade it out.
  // This masks the instant color swap underneath so switching Light/Dark/System
  // reads as a smooth transition instead of a jarring snap.
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const previousMode = useRef(mode);

  useEffect(() => {
    if (previousMode.current !== mode) {
      previousMode.current = mode;
      overlayOpacity.setValue(1);
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ colors, mode, preference, setPreference }}>
      <View style={{ flex: 1 }}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: overlayOpacity }]}
        />
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
