import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { OrganizerEvent, CATEGORY_STYLES } from '../models/Event';
import { loadSettings } from './settingsStorageService';

export const REMINDER_CATEGORY = 'reminder-actions';
const SNOOZE_MINUTES = 10;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
  // Registers the "Snooze" / "Dismiss" action buttons that appear on
  // reminder notifications (iOS: long-press the notification; Android:
  // buttons show directly).
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
    { identifier: 'snooze', buttonTitle: `Snooze ${SNOOZE_MINUTES} min` },
    { identifier: 'dismiss', buttonTitle: 'Dismiss', options: { isDestructive: true } },
  ]);
}

/** Gets this device's Expo push token and saves it on the user's profile —
 * this is what the Cloud Function reads to know where to send a real
 * background push notification. Safe to call every launch; overwrites with
 * the current token each time (tokens can occasionally change). */
export async function registerPushToken(uid: string): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return; // eas init hasn't run yet, or app.json isn't synced — nothing to register with

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await setDoc(doc(db, 'users', uid), { pushToken: tokenData.data }, { merge: true });
  } catch {
    // Push token registration failing shouldn't block anything else in the
    // app — local reminders still work fine either way.
  }
}

function notificationId(eventId: string): string {
  return `event-${eventId}`;
}

/** If quiet hours are enabled and this date falls inside the window, pushes
 * it forward to the end of the quiet window instead of firing silently
 * skipped — so reminders are delayed, not lost. */
async function applyQuietHours(date: Date): Promise<Date> {
  const settings = await loadSettings();
  if (!settings.quietHoursEnabled) return date;
  const start = settings.quietHoursStart ?? 22;
  const end = settings.quietHoursEnd ?? 7;
  const hour = date.getHours();

  const inQuietWindow = start <= end ? (hour >= start && hour < end) : (hour >= start || hour < end);
  if (!inQuietWindow) return date;

  const adjusted = new Date(date);
  if (hour >= start) {
    // Same night, push to end-of-window the next calendar day.
    adjusted.setDate(adjusted.getDate() + 1);
  }
  adjusted.setHours(end, 0, 0, 0);
  return adjusted;
}

/** Schedules (or replaces) a local reminder notification for an event. */
export async function scheduleReminder(event: OrganizerEvent): Promise<void> {
  await cancelReminder(event.id);
  if (event.reminderMinutesBefore < 0) return;

  const eventDate = new Date(event.date);
  let fireDate = new Date(eventDate.getTime() - event.reminderMinutesBefore * 60000);
  if (fireDate <= new Date()) return;

  fireDate = await applyQuietHours(fireDate);

  await Notifications.scheduleNotificationAsync({
    identifier: notificationId(event.id),
    content: {
      title: event.title,
      body: reminderBody(event),
      sound: true,
      categoryIdentifier: REMINDER_CATEGORY,
      data: { eventId: event.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
  });
}

/** Reschedules a reminder SNOOZE_MINUTES from now, reusing the same content. */
export async function snoozeReminder(title: string, body: string, eventId: string): Promise<void> {
  const fireDate = new Date(Date.now() + SNOOZE_MINUTES * 60000);
  await Notifications.scheduleNotificationAsync({
    content: { title, body: `${body} (snoozed)`, sound: true, categoryIdentifier: REMINDER_CATEGORY, data: { eventId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
  });
}

export async function cancelReminder(eventId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId(eventId));
}

function reminderBody(event: OrganizerEvent): string {
  let base: string;
  if (event.category === 'birthday') base = 'Birthday reminder';
  else if (event.category === 'anniversary') base = 'Anniversary reminder';
  else if (event.reminderMinutesBefore === 0) base = 'Starting now';
  else if (event.reminderMinutesBefore < 60) base = `Starts in ${event.reminderMinutesBefore} min`;
  else {
    const hours = Math.round(event.reminderMinutesBefore / 60);
    base = `Starts in ${hours}h`;
  }

  // If the event has notes, surface them right in the notification — this
  // is what gives reminders that warm, specific "don't forget the shoes"
  // feel instead of a generic time-based ping.
  if (event.notes && event.notes.trim()) {
    return `${base}. ${event.notes.trim()}`;
  }
  return base;
}
