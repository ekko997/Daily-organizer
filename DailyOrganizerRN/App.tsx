import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { format } from 'date-fns';
import * as Localization from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermission } from './src/services/notificationService';
import { loadSettings, saveSettings } from './src/services/settingsStorageService';
import { subscribeToEvents, subscribeToFamilyActivity, CloudEvent, EventScope } from './src/services/cloudEventService';
import { CATEGORY_STYLES } from './src/models/Event';
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
import { ToastProvider, useToast } from './src/utils/ToastContext';

const Tab = createBottomTabNavigator();

function LoadingScreen({ error, showSignOut }: { error?: string | null; showSignOut?: boolean }) {
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const [showEscape, setShowEscape] = useState(false);

  useEffect(() => {
    // If we're stuck spinning (no error yet) for more than a few seconds,
    // reveal a sign-out option so this screen is never a dead end.
    const timer = setTimeout(() => setShowEscape(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24, gap: 20 }}>
      {error ? (
        <Text style={{ color: colors.holiday, textAlign: 'center', fontSize: 14 }}>{error}</Text>
      ) : (
        <ActivityIndicator color={colors.accent} size="large" />
      )}
      {(showSignOut || error || showEscape) && (
        <Pressable onPress={signOut}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Sign out and try again</Text>
        </Pressable>
      )}
    </View>
  );
}

function MainApp() {
  const { user } = useAuth();
  const { family, members } = useFamily();
  const { showToast } = useToast();
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
  }, [user?.uid, family?.id]);

  // Notifies about family calendar changes made by other members while this
  // app is running (open or recently backgrounded). This is NOT the same as
  // a true push notification reaching a fully closed app — that needs a
  // server-side trigger (Cloud Functions), which is separate infrastructure.
  useEffect(() => {
    if (!user || !family) return;
    const unsubscribe = subscribeToFamilyActivity(user.uid, family.id, ({ type, event }) => {
      const authorEmail = members.find(m => m.uid === event.lastModifiedBy)?.email;
      const authorName = authorEmail ? authorEmail.split('@')[0] : 'Someone';
      const categoryLabel = CATEGORY_STYLES[event.category]?.label ?? 'event';
      const dateLabel = format(new Date(event.date), 'MMM d');

      const message =
        type === 'added' ? `${authorName} added a new ${categoryLabel.toLowerCase()}: "${event.title}" on ${dateLabel}` :
        type === 'removed' ? `"${event.title}" was removed from the family calendar` :
        `${authorName} updated "${event.title}"`;

      showToast({ message, duration: 4000 });
      Notifications.scheduleNotificationAsync({
        content: { title: family.name, body: message, sound: true },
        trigger: null, // fires immediately, as a real device notification
      }).catch(() => {});
    });
    return unsubscribe;
  }, [user?.uid, family?.id, members]);

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
      <ToastProvider>
        <AuthProvider>
          <FamilyProvider>
            <RootGate />
          </FamilyProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
