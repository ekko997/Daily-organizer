import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
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

  return (
    <ThemeContext.Provider value={{ colors, mode, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
