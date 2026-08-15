import { startOfMonth, startOfWeek, addDays, isSameDay as dfIsSameDay, startOfDay } from 'date-fns';

/** Full 6x7 grid of dates for a month view, including leading/trailing days
 * from adjacent months so the grid height stays consistent. */
export function gridDates(monthContaining: Date): Date[] {
  const monthStart = startOfMonth(monthContaining);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return dfIsSameDay(a, b);
}

export function dayStart(date: Date): Date {
  return startOfDay(date);
}

export function isoDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}
