import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import { OrganizerEvent } from './src/models/Event';
import { loadEvents } from './src/services/storageService';
import { requestNotificationPermission } from './src/services/notificationService';
import { loadSettings, saveSettings } from './src/services/settingsStorageService';
import TodayScreen from './src/screens/TodayScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AgendaScreen from './src/screens/AgendaScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { EventsContext } from './src/utils/EventsContext';
import { ThemeProvider, useTheme } from './src/utils/ThemeContext';

const Tab = createBottomTabNavigator();

function AppContent() {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [countryCode, setCountryCodeState] = useState<string>(Localization.getLocales()[0]?.regionCode || 'US');
  const [region, setRegionState] = useState<string>('');
  const [cityName, setCityName] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const { colors, mode } = useTheme();

  const refreshEvents = useCallback(async () => {
    setEvents(await loadEvents());
  }, []);

  useEffect(() => {
    requestNotificationPermission();
    refreshEvents();
    loadSettings().then(saved => {
      if (saved.countryCode) setCountryCodeState(saved.countryCode);
      if (saved.region) setRegionState(saved.region);
      if (saved.cityName) setCityName(saved.cityName);
      if (typeof saved.latitude === 'number') setLatitude(saved.latitude);
      if (typeof saved.longitude === 'number') setLongitude(saved.longitude);
    });
  }, [refreshEvents]);

  function setCountryCode(code: string) {
    setCountryCodeState(code);
    saveSettings({ countryCode: code });
  }

  function setRegion(r: string) {
    setRegionState(r);
    saveSettings({ region: r });
  }

  function setLocation(name: string, lat: number, lon: number) {
    setCityName(name);
    setLatitude(lat);
    setLongitude(lon);
    saveSettings({ cityName: name, latitude: lat, longitude: lon });
  }

  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.background,
      border: colors.border,
      text: colors.textPrimary,
      primary: colors.accent,
    },
  };

  return (
    <EventsContext.Provider value={{ events, refreshEvents, countryCode, setCountryCode, region, setRegion, cityName, latitude, longitude, setLocation }}>
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          initialRouteName="Today"
          screenOptions={{
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
          }}
        >
          <Tab.Screen
            name="Today"
            component={TodayScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="sunny" size={size} color={color} /> }}
          />
          <Tab.Screen
            name="Calendar"
            component={CalendarScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }}
          />
          <Tab.Screen
            name="Agenda"
            component={AgendaScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </EventsContext.Provider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
