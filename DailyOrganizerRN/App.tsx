import React, { useEffect, useState, useCallback, useRef } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, Text, Pressable, Animated } from 'react-native';
import * as Linking from 'expo-linking';
import { format } from 'date-fns';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermission, snoozeReminder } from './src/services/notificationService';
import { loadSettings, saveSettings } from './src/services/settingsStorageService';
import { isBiometricAvailable, authenticateWithBiometrics } from './src/services/biometricService';
import { subscribeToEvents, subscribeToFamilyActivity, CloudEvent, EventScope } from './src/services/cloudEventService';
import { occurrencesInRange } from './src/services/recurrenceEngine';
import { CATEGORY_STYLES } from './src/models/Event';
import TodayScreen from './src/screens/TodayScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AgendaScreen from './src/screens/AgendaScreen';
import TodoScreen from './src/screens/TodoScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AuthScreen from './src/screens/AuthScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import FamilySetupScreen from './src/screens/FamilySetupScreen';
import { EventsContext } from './src/utils/EventsContext';
import { ThemeProvider, useTheme } from './src/utils/ThemeContext';
import { AuthProvider, useAuth } from './src/utils/AuthContext';
import { FamilyProvider, useFamily } from './src/utils/FamilyContext';
import { ToastProvider, useToast } from './src/utils/ToastContext';
import { PendingInviteContext } from './src/utils/PendingInviteContext';
import { haptics } from './src/utils/haptics';
import { memberDisplayName } from './src/utils/memberColor';
import { useFonts, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { initErrorReporting } from './src/services/errorReporting';
import ErrorBoundary from './src/components/ErrorBoundary';

const Tab = createBottomTabNavigator();

function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: any }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return <Animated.View style={[{ width, height, borderRadius: 8, backgroundColor: colors.border, opacity }, style]} />;
}

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

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24, gap: 20 }}>
        <Text style={{ color: colors.holiday, textAlign: 'center', fontSize: 14 }}>{error}</Text>
        <Pressable onPress={signOut}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Sign out and try again</Text>
        </Pressable>
      </View>
    );
  }

  // Mimics the Today screen's layout so the loading state feels like part
  // of the app rather than a generic blocking spinner.
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60, gap: 12 }}>
      <SkeletonBlock width={140} height={16} />
      <SkeletonBlock width={200} height={28} style={{ marginBottom: 16 }} />
      <SkeletonBlock width="100%" height={80} style={{ marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
        <SkeletonBlock width="33%" height={70} />
        <SkeletonBlock width="33%" height={70} />
        <SkeletonBlock width="33%" height={70} />
      </View>
      <SkeletonBlock width={60} height={16} style={{ marginBottom: 8 }} />
      <SkeletonBlock width="100%" height={56} />
      <SkeletonBlock width="100%" height={56} />
      <SkeletonBlock width="100%" height={56} />
      {showSignOut && (
        <Pressable onPress={signOut} style={{ marginTop: 20, alignSelf: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Sign out and try again</Text>
        </Pressable>
      )}
      {showEscape && (
        <Pressable onPress={signOut} style={{ marginTop: 20, alignSelf: 'center' }}>
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
  const [rawEvents, setRawEvents] = useState<CloudEvent[]>([]);
  const [activeScope, setActiveScope] = useState<EventScope>('personal');
  const [restrictToOwnEvents, setRestrictToOwnEventsState] = useState(false);

  function setRestrictToOwnEvents(value: boolean) {
    setRestrictToOwnEventsState(value);
    saveSettings({ restrictToOwnEvents: value });
  }

  // If the family goes away for any reason (left it, was removed, a stale
  // reference), never leave the app pointed at a "family" scope that no
  // longer exists — that produced broken family-scoped events with no
  // actual family behind them.
  useEffect(() => {
    if (!family && activeScope === 'family') setActiveScope('personal');
  }, [family, activeScope]);
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
      setRestrictToOwnEventsState(!!saved.restrictToOwnEvents);
    });
  }, []);

  // Handles taps on the "Snooze" / "Dismiss" buttons on reminder notifications.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const { actionIdentifier, notification } = response;
      if (actionIdentifier === 'snooze') {
        const content = notification.request.content;
        const eventId = (content.data as any)?.eventId ?? 'unknown';
        snoozeReminder(content.title || 'Reminder', content.body || '', eventId).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToEvents(user.uid, family?.id ?? null, setRawEvents);
    return unsubscribe;
  }, [user?.uid, family?.id]);

  // "Kid-safe mode" — a soft, display-level filter (not a security
  // restriction; anyone can toggle it off) that hides family events
  // explicitly assigned to someone else. Centralized here so every
  // screen respects it automatically without individual changes.
  useEffect(() => {
    if (!restrictToOwnEvents || !user) {
      setEvents(rawEvents);
      return;
    }
    setEvents(rawEvents.filter(e => e.scope !== 'family' || !e.assignedTo || e.assignedTo === user.uid));
  }, [rawEvents, restrictToOwnEvents, user?.uid]);

  // Keeps the app icon's badge showing today's event count, so you can see
  // at a glance how busy the day is without opening the app.
  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    let count = 0;
    for (const event of events) count += occurrencesInRange(event, start, end).length;
    Notifications.setBadgeCountAsync(count).catch(() => {});
  }, [events]);

  // Notifies about family calendar changes made by other members while this
  // app is running (open or recently backgrounded). This is NOT the same as
  // a true push notification reaching a fully closed app — that needs a
  // server-side trigger (Cloud Functions), which is separate infrastructure.
  useEffect(() => {
    if (!user || !family) return;
    const unsubscribe = subscribeToFamilyActivity(user.uid, family.id, ({ type, event }) => {
      const authorName = memberDisplayName(members.find(m => m.uid === event.lastModifiedBy));
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
    <EventsContext.Provider value={{ events, activeScope, setActiveScope, countryCode, setCountryCode, region, setRegion, cityName, latitude, longitude, setLocation, restrictToOwnEvents, setRestrictToOwnEvents }}>
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          initialRouteName="Today"
          screenListeners={{
            tabPress: () => haptics.light(),
          }}
          screenOptions={{
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
            // Native, built-in synchronized transition: both the outgoing and
            // incoming tab shift together in the direction of travel, rather
            // than a hand-rolled animation on just the incoming screen.
            animation: 'shift',
          }}
        >
          <Tab.Screen name="Today" component={TodayScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="sunny" size={size} color={color} /> }} />
          <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }} />
          <Tab.Screen name="Agenda" component={AgendaScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }} />
          <Tab.Screen name="To-Do" component={TodoScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" size={size} color={color} /> }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }} />
        </Tab.Navigator>
      </NavigationContainer>
    </EventsContext.Provider>
  );
}

function AppLockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const [attempting, setAttempting] = useState(false);

  const tryUnlock = useCallback(async () => {
    setAttempting(true);
    const success = await authenticateWithBiometrics();
    setAttempting(false);
    if (success) onUnlocked();
  }, [onUnlocked]);

  useEffect(() => {
    tryUnlock();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24, gap: 20 }}>
      <Ionicons name="lock-closed" size={40} color={colors.textSecondary} />
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>Steady Days is locked</Text>
      <Pressable style={{ backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 }} onPress={tryUnlock} disabled={attempting}>
        <Text style={{ color: colors.white, fontWeight: '700' }}>{attempting ? 'Checking...' : 'Unlock'}</Text>
      </Pressable>
      <Pressable onPress={signOut}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Sign out instead</Text>
      </Pressable>
    </View>
  );
}

function RootGate() {
  const { user, initializing } = useAuth();
  const { loading: familyLoading } = useFamily();
  const [checkingLock, setCheckingLock] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | undefined>(undefined);
  const [checkingWelcome, setCheckingWelcome] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('seen_welcome_v1').then(seen => {
      setShowWelcome(!seen);
      setCheckingWelcome(false);
    });
  }, []);

  function dismissWelcome() {
    setShowWelcome(false);
    AsyncStorage.setItem('seen_welcome_v1', 'true');
  }

  // Catches taps on a shared invite link (dailyorganizer://join?code=XXXXXX)
  // and hands the code to Settings, where family setup now lives (it's no
  // longer a screen forced on every launch).
  useEffect(() => {
    function extractCode(url: string | null) {
      if (!url) return;
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code;
      if (typeof code === 'string') setPendingInviteCode(code);
    }
    Linking.getInitialURL().then(extractCode);
    const subscription = Linking.addEventListener('url', ({ url }) => extractCode(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!user) {
      setCheckingLock(false);
      return;
    }
    loadSettings().then(async saved => {
      if (saved.biometricLockEnabled && (await isBiometricAvailable())) {
        setLocked(true);
      }
      setCheckingLock(false);
    });
  }, [user?.uid]);

  if (initializing) return <LoadingScreen />;
  if (!user) {
    if (checkingWelcome) return <LoadingScreen />;
    if (showWelcome) return <WelcomeScreen onContinue={dismissWelcome} />;
    return <AuthScreen />;
  }
  if (checkingLock) return <LoadingScreen />;
  if (locked) return <AppLockScreen onUnlocked={() => setLocked(false)} />;
  if (familyLoading) return <LoadingScreen />;
  // No family? That's a completely normal, permanent state — the app works
  // fully in personal-only mode. Family sharing is opt-in from Settings.
  return (
    <PendingInviteContext.Provider value={{ pendingInviteCode, clearPendingInviteCode: () => setPendingInviteCode(undefined) }}>
      <MainApp />
    </PendingInviteContext.Provider>
  );
}

export default function App() {
  // Kicks off loading the Manrope display font in the background. No need
  // to gate rendering on this — React Native silently falls back to the
  // system font for any Text using 'Manrope_...' until it's registered,
  // then picks it up automatically on the next re-render once ready.
  useFonts({ Manrope_700Bold, Manrope_800ExtraBold });

  useEffect(() => {
    initErrorReporting();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <FamilyProvider>
              <RootGate />
            </FamilyProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
