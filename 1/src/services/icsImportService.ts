export interface ParsedIcsEvent {
  title: string;
  date: string; // ISO string
  notes: string;
  location: string;
}

/**
 * Basic VEVENT parser — handles SUMMARY, DTSTART, DESCRIPTION, LOCATION.
 * Doesn't handle recurrence rules (RRULE) — imported events come in as
 * single, non-recurring events, which covers the common case (importing
 * a handful of appointments from another calendar).
 */
export function parseIcsEvents(icsContent: string): ParsedIcsEvent[] {
  const events: ParsedIcsEvent[] = [];
  const blocks = icsContent.split('BEGIN:VEVENT').slice(1);

  for (const block of blocks) {
    const body = block.split('END:VEVENT')[0];
    const summary = extractField(body, 'SUMMARY');
    const dtstart = extractField(body, 'DTSTART');
    const description = extractField(body, 'DESCRIPTION');
    const location = extractField(body, 'LOCATION');

    if (!summary || !dtstart) continue;
    const date = parseIcsDate(dtstart);
    if (!date) continue;

    events.push({
      title: summary.trim(),
      date: date.toISOString(),
      notes: description?.trim() || '',
      location: location?.trim() || '',
    });
  }

  return events;
}

function extractField(block: string, field: string): string | null {
  // Handles both "FIELD:value" and "FIELD;PARAM=x:value" forms.
  const regex = new RegExp(`${field}(;[^:]*)?:(.*)`, 'i');
  const match = block.match(regex);
  return match ? match[2].trim() : null;
}

function parseIcsDate(raw: string): Date | null {
  // Formats: 20260819T140000Z or 20260819T140000 or 20260819
  const clean = raw.replace(/[^0-9TZ]/g, '');
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, , hour = '00', minute = '00', second = '00'] = match;
  const isUtc = clean.endsWith('Z');
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${isUtc ? 'Z' : ''}`;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}
