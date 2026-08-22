import * as Notifications from 'expo-notifications';
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
  if (event.category === 'birthday') return 'Birthday reminder';
  if (event.category === 'anniversary') return 'Anniversary reminder';
  if (event.reminderMinutesBefore === 0) return 'Starting now';
  if (event.reminderMinutesBefore < 60) return `Starts in ${event.reminderMinutesBefore} min`;
  const hours = Math.round(event.reminderMinutesBefore / 60);
  return `Starts in ${hours}h`;
}
