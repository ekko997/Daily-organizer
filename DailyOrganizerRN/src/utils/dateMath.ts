import { differenceInYears, differenceInMinutes, differenceInHours, format } from 'date-fns';
import { OrganizerEvent } from '../models/Event';

/** For a recurring yearly birthday/anniversary, how many years since the original date. */
export function yearsSinceOriginal(event: OrganizerEvent, occurrenceDate: Date): number | null {
  if (event.recurrence !== 'yearly') return null;
  const original = new Date(event.date);
  return differenceInYears(occurrenceDate, original);
}

/** Human-readable countdown like "in 2h 15m" or "in 3 days". */
export function countdownLabel(target: Date): string {
  const now = new Date();
  const minutes = differenceInMinutes(target, now);
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes}m`;
  const hours = differenceInHours(target, now);
  if (hours < 24) {
    const remMinutes = minutes - hours * 60;
    return remMinutes > 0 ? `in ${hours}h ${remMinutes}m` : `in ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/** Merges a per-occurrence override (title/notes/location/meetingLink) into
 * a shallow copy of the event, for display purposes only — the stored base
 * event is never mutated. Returns the event unchanged if no override exists
 * for this occurrence's date. */
export function withOccurrenceOverride<T extends OrganizerEvent>(event: T, occurrenceDate: Date): T {
  const override = event.occurrenceOverrides?.[format(occurrenceDate, 'yyyy-MM-dd')];
  if (!override) return event;
  return { ...event, ...override };
}
