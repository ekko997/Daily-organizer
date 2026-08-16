export type EventCategory = 'work' | 'appointment' | 'birthday' | 'anniversary' | 'personal' | 'reminder';
export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CategoryStyle {
  label: string;
  color: string;
  icon: string; // Ionicons name
}

export const CATEGORY_STYLES: Record<EventCategory, CategoryStyle> = {
  work: { label: 'Work', color: '#5973E6', icon: 'briefcase' },
  appointment: { label: 'Appointment', color: '#33A69A', icon: 'time' },
  birthday: { label: 'Birthday', color: '#F28C59', icon: 'gift' },
  anniversary: { label: 'Anniversary', color: '#D9598C', icon: 'heart' },
  personal: { label: 'Personal', color: '#8C8C90', icon: 'person' },
  reminder: { label: 'Reminder', color: '#B38CE6', icon: 'notifications' },
};

export const REMINDER_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'None', minutes: -1 },
  { label: 'At time of event', minutes: 0 },
  { label: '15 min before', minutes: 15 },
  { label: '30 min before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '1 day before', minutes: 1440 },
];

export interface OrganizerEvent {
  id: string;
  title: string;
  notes: string;
  date: string;          // ISO 8601 string
  isAllDay: boolean;
  category: EventCategory;
  recurrence: RecurrenceRule;
  reminderMinutesBefore: number; // -1 = no reminder
  createdAt: string;
  location?: string;
  meetingLink?: string;
  // ISO yyyy-MM-dd dates of individual occurrences removed from a recurring
  // series (e.g. "skip this one week" without deleting the whole series).
  excludedDates?: string[];
}

export function defaultsToYearlyRecurrence(category: EventCategory): boolean {
  return category === 'birthday' || category === 'anniversary';
}
