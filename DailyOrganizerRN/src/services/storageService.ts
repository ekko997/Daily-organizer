import AsyncStorage from '@react-native-async-storage/async-storage';
import { OrganizerEvent } from '../models/Event';

const STORAGE_KEY = 'daily_organizer_events_v1';

export async function loadEvents(): Promise<OrganizerEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveAll(events: OrganizerEvent[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export async function upsertEvent(event: OrganizerEvent): Promise<OrganizerEvent[]> {
  const events = await loadEvents();
  const index = events.findIndex(e => e.id === event.id);
  if (index >= 0) {
    events[index] = event;
  } else {
    events.push(event);
  }
  await saveAll(events);
  return events;
}

export async function deleteEvent(id: string): Promise<OrganizerEvent[]> {
  const events = await loadEvents();
  const filtered = events.filter(e => e.id !== id);
  await saveAll(filtered);
  return filtered;
}
