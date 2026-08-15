import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { OrganizerEvent } from '../models/Event';

export type EventScope = 'personal' | 'family';

export interface CloudEvent extends OrganizerEvent {
  ownerId: string;
  scope: EventScope;
  familyId: string | null;
}

/**
 * Subscribes to every event visible to this user: their own personal events,
 * plus every event shared with their family (if they're in one). Calls
 * onChange with the merged list whenever either source updates — this fires
 * live when any family member adds/edits/deletes something.
 * Returns an unsubscribe function.
 */
export function subscribeToEvents(
  uid: string,
  familyId: string | null,
  onChange: (events: CloudEvent[]) => void
): () => void {
  let personalEvents: CloudEvent[] = [];
  let familyEvents: CloudEvent[] = [];

  function emit() {
    onChange([...personalEvents, ...familyEvents]);
  }

  const personalQuery = query(
    collection(db, 'events'),
    where('ownerId', '==', uid),
    where('scope', '==', 'personal')
  );
  const unsubPersonal = onSnapshot(personalQuery, snap => {
    personalEvents = snap.docs.map(d => d.data() as CloudEvent);
    emit();
  });

  let unsubFamily = () => {};
  if (familyId) {
    const familyQuery = query(
      collection(db, 'events'),
      where('familyId', '==', familyId),
      where('scope', '==', 'family')
    );
    unsubFamily = onSnapshot(familyQuery, snap => {
      familyEvents = snap.docs.map(d => d.data() as CloudEvent);
      emit();
    });
  }

  return () => {
    unsubPersonal();
    unsubFamily();
  };
}

export async function upsertCloudEvent(event: CloudEvent): Promise<void> {
  await setDoc(doc(db, 'events', event.id), event);
}

export async function deleteCloudEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(db, 'events', eventId));
}
