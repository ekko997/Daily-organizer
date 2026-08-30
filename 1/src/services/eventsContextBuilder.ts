import { addDays, format } from 'date-fns';
import { CloudEvent } from './cloudEventService';
import { occurrencesInRange } from './recurrenceEngine';
import { CATEGORY_STYLES } from '../models/Event';

/** Builds a compact text list of upcoming events (next 90 days) for the AI
 * to answer questions against — kept short and plain to hold down cost,
 * capped so a very full calendar doesn't blow up the request. */
export function buildEventsContext(events: CloudEvent[], maxEvents = 150): string {
  const start = addDays(new Date(), -3); // include very recent past too
  const end = addDays(new Date(), 90);

  const lines: { date: Date; text: string }[] = [];
  for (const event of events) {
    const occurrences = occurrencesInRange(event, start, end);
    for (const occ of occurrences) {
      const categoryLabel = CATEGORY_STYLES[event.category]?.label ?? event.category;
      const timeLabel = event.isAllDay ? 'all day' : format(occ, 'h:mm a');
      const locationPart = event.location ? ` at ${event.location}` : '';
      lines.push({ date: occ, text: `${event.title} (${categoryLabel}) — ${format(occ, 'EEE MMM d')}, ${timeLabel}${locationPart}` });
    }
  }

  lines.sort((a, b) => a.date.getTime() - b.date.getTime());
  return lines.slice(0, maxEvents).map(l => l.text).join('\n');
}
