import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import { OrganizerEvent } from './src/models/Event';
import { loadEvents } from './src/services/storageService';
import { requestNotificationPermission } from './src/services/notificationService';
import TodayScreen from './src/screens/TodayScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AgendaScreen from './src/screens/AgendaScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { EventsContext } from './src/utils/EventsContext';

const Tab = createBottomTabNavigator();

export default function App() {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [countryCode, setCountryCode] = useState<string>(Localization.getLocales()[0]?.regionCode || 'US');
  const [region, setRegion] = useState<string>('');

  const refreshEvents = useCallback(async () => {
    setEvents(await loadEvents());
  }, []);

  useEffect(() => {
    requestNotificationPermission();
    refreshEvents();
  }, [refreshEvents]);

  return (
    <EventsContext.Provider value={{ events, refreshEvents, countryCode, setCountryCode, region, setRegion }}>
      <NavigationContainer>
        <Tab.Navigator initialRouteName="Today" screenOptions={{ tabBarActiveTintColor: '#5973E6' }}>
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
