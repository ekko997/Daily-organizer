import { httpsCallable } from 'firebase/functions';
import { cloudFunctions } from './firebase';
import { EventCategory } from '../models/Event';

export interface ParsedEventDraft {
  title: string;
  date: string; // ISO string
  isAllDay: boolean;
  category: EventCategory;
  location: string | null;
}

/** Sends free-text ("dentist next Tuesday 3pm") to the server-side AI
 * parser and gets back structured event fields to prefill the form with —
 * nothing is saved automatically, the person still reviews and confirms. */
export async function parseEventText(text: string): Promise<ParsedEventDraft> {
  const callable = httpsCallable(cloudFunctions, 'parseEventText');
  const result = await callable({ text });
  return result.data as ParsedEventDraft;
}
