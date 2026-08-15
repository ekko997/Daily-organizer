import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, Text } from 'react-native';
import * as Localization from 'expo-localization';
import { requestNotificationPermission } from './src/services/notificationService';
import { loadSettings, saveSettings } from './src/services/settingsStorageService';
import { subscribeToEvents, CloudEvent, EventScope } from './src/services/cloudEventService';
import TodayScreen from './src/screens/TodayScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AgendaScreen from './src/screens/AgendaScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AuthScreen from './src/screens/AuthScreen';
import FamilySetupScreen from './src/screens/FamilySetupScreen';
import { EventsContext } from './src/utils/EventsContext';
import { ThemeProvider, useTheme } from './src/utils/ThemeContext';
import { AuthProvider, useAuth } from './src/utils/AuthContext';
import { FamilyProvider, useFamily } from './src/utils/FamilyContext';

const Tab = createBottomTabNavigator();

function LoadingScreen({ error }: { error?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 }}>
      {error ? (
        <Text style={{ color: colors.holiday, textAlign: 'center', fontSize: 14 }}>{error}</Text>
      ) : (
        <ActivityIndicator color={colors.accent} size="large" />
      )}
    </View>
  );
}

function MainApp() {
  const { user } = useAuth();
  const { family } = useFamily();
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [activeScope, setActiveScope] = useState<EventScope>('personal');
  const [countryCode, setCountryCodeState] = useState<string>(Localization.getLocales()[0]?.regionCode || 'US');
  const [region, setRegionState] = useState<string>('');
  const [cityName, setCityName] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const { colors, mode } = useTheme();

  useEffect(() => {
    requestNotificationPermission();
    loadSettings().then(saved => {
      if (saved.countryCode) setCountryCodeState(saved.countryCode);
      if (saved.region) setRegionState(saved.region);
      if (saved.cityName) setCityName(saved.cityName);
      if (typeof saved.latitude === 'number') setLatitude(saved.latitude);
      if (typeof saved.longitude === 'number') setLongitude(saved.longitude);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToEvents(user.uid, family?.id ?? null, setEvents);
    return unsubscribe;
  }, [user, family?.id]);

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
    <EventsContext.Provider value={{ events, activeScope, setActiveScope, countryCode, setCountryCode, region, setRegion, cityName, latitude, longitude, setLocation }}>
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          initialRouteName="Today"
          screenOptions={{
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
          }}
        >
          <Tab.Screen name="Today" component={TodayScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="sunny" size={size} color={color} /> }} />
          <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }} />
          <Tab.Screen name="Agenda" component={AgendaScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }} />
        </Tab.Navigator>
      </NavigationContainer>
    </EventsContext.Provider>
  );
}

function RootGate() {
  const { user, initializing } = useAuth();
  const { family, loading: familyLoading, loadError } = useFamily();

  if (initializing) return <LoadingScreen />;
  if (!user) return <AuthScreen />;
  if (loadError) return <LoadingScreen error={loadError} />;
  if (familyLoading) return <LoadingScreen />;
  if (!family) return <FamilySetupScreen />;
  return <MainApp />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FamilyProvider>
          <RootGate />
        </FamilyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
