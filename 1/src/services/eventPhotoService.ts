import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/** Uploads a photo for an event and returns its download URL. `uri` is a
 * local file URI from the image picker (file://... or content://...). */
export async function uploadEventPhoto(eventId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const photoRef = ref(storage, `event-photos/${eventId}.jpg`);
  await uploadBytes(photoRef, blob);
  return getDownloadURL(photoRef);
}

/** Best-effort delete — failures here (e.g. the file was already removed)
 * shouldn't block the rest of a save/delete flow. */
export async function deleteEventPhoto(eventId: string): Promise<void> {
  try {
    await deleteObject(ref(storage, `event-photos/${eventId}.jpg`));
  } catch {
    // ignore — nothing to clean up, or it's already gone
  }
}
