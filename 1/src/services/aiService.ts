import { httpsCallable } from 'firebase/functions';
import { cloudFunctions } from './firebase';
import { EventCategory } from '../models/Event';

export interface ParsedEventDraft {
  title: string;
  date: string; // local time string, no timezone suffix — interpret as local
  isAllDay: boolean;
  category: EventCategory;
  location: string | null;
  confirmation: string;
}

function localNowString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/** Sends free-text ("dentist next Tuesday 3pm") to the server-side AI
 * parser and gets back structured event fields to prefill the form with —
 * nothing is saved automatically, the person still reviews and confirms.
 * Sends the device's actual local time/timezone so the AI resolves times
 * like "3pm" correctly instead of guessing against a server clock. */
export async function parseEventText(text: string): Promise<ParsedEventDraft> {
  const callable = httpsCallable(cloudFunctions, 'parseEventText');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const result = await callable({ text, localNow: localNowString(), timeZone });
  return result.data as ParsedEventDraft;
}

/** Same idea as parseEventText, but from a photo — a flyer, invite, or
 * school note. `base64Image` should be a compressed JPEG, already resized
 * client-side to keep the request small. */
export async function parseEventPhoto(base64Image: string, mimeType: string): Promise<ParsedEventDraft> {
  const callable = httpsCallable(cloudFunctions, 'parseEventPhoto');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const result = await callable({ imageBase64: base64Image, mimeType, localNow: localNowString(), timeZone });
  return result.data as ParsedEventDraft;
}
