import { addDays, addWeeks, addMonths, addYears, isWithinInterval, format } from 'date-fns';
import { OrganizerEvent, RecurrenceRule } from '../models/Event';

/**
 * Returns all occurrence Dates of `event` that fall within [start, end].
 * Non-repeating events return just their own date if it's in range.
 * Skips any date listed in event.excludedDates (a single occurrence removed
 * from a recurring series without deleting the whole series).
 * Mirrors the logic in the original Swift RecurrenceEngine so behavior
 * stays consistent between the two builds.
 */
export function occurrencesInRange(event: OrganizerEvent, start: Date, end: Date): Date[] {
  const eventDate = new Date(event.date);
  const excluded = new Set(event.excludedDates || []);
  const isExcluded = (d: Date) => excluded.has(format(d, 'yyyy-MM-dd'));

  if (event.recurrence === 'none') {
    return isWithinInterval(eventDate, { start, end }) && !isExcluded(eventDate) ? [eventDate] : [];
  }
  if (eventDate > end) return [];

  const results: Date[] = [];
  let current = eventDate;
  let iterations = 0;
  const MAX_ITERATIONS = 2000; // safety cap against runaway loops

  while (current <= end && iterations < MAX_ITERATIONS) {
    if (current >= start && !isExcluded(current)) results.push(current);
    const next = nextDate(current, event.recurrence);
    if (!next) break;
    current = next;
    iterations++;
  }
  return results;
}

function nextDate(date: Date, rule: RecurrenceRule): Date | null {
  switch (rule) {
    case 'daily': return addDays(date, 1);
    case 'weekly': return addWeeks(date, 1);
    case 'monthly': return addMonths(date, 1);
    case 'yearly': return addYears(date, 1);
    default: return null;
  }
}
