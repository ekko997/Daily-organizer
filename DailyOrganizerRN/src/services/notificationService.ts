import * as Notifications from 'expo-notifications';
import { OrganizerEvent, CATEGORY_STYLES } from '../models/Event';

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

/** Schedules (or replaces) a local reminder notification for an event. */
export async function scheduleReminder(event: OrganizerEvent): Promise<void> {
  await cancelReminder(event.id);
  if (event.reminderMinutesBefore < 0) return;

  const eventDate = new Date(event.date);
  const fireDate = new Date(eventDate.getTime() - event.reminderMinutesBefore * 60000);
  if (fireDate <= new Date()) return;

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
