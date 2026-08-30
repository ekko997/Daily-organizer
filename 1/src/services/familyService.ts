import { doc, getDoc, getDocFromServer, getDocs as getDocsCollection, setDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, documentId } from 'firebase/firestore';
import { db } from './firebase';
import { reportError } from './errorReporting';

export interface FamilyDoc {
  id: string;
  name: string;
  inviteCode: string;
  members: string[];
  createdBy: string;
}

export interface MemberProfile {
  uid: string;
  email: string;
  displayName?: string;
}

// Excludes visually ambiguous characters (0/O, 1/I) so codes are easy to read aloud or type.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export async function createFamily(uid: string, name: string): Promise<FamilyDoc> {
  const inviteCode = generateInviteCode();
  const familyRef = doc(collection(db, 'families'));
  const family: FamilyDoc = { id: familyRef.id, name, inviteCode, members: [uid], createdBy: uid };
  await setDoc(familyRef, family);
  await setDoc(doc(db, 'users', uid), { familyId: familyRef.id }, { merge: true });
  return family;
}

export async function joinFamily(uid: string, inviteCode: string): Promise<FamilyDoc | null> {
  const q = query(collection(db, 'families'), where('inviteCode', '==', inviteCode.toUpperCase().trim()));
  const snap = await getDocsCollection(q);
  if (snap.empty) return null;
  const familyDoc = snap.docs[0];
  await updateDoc(familyDoc.ref, { members: arrayUnion(uid) });
  await setDoc(doc(db, 'users', uid), { familyId: familyDoc.id }, { merge: true });
  return { id: familyDoc.id, ...(familyDoc.data() as any) };
}

// Temporary diagnostic — the most recent raw result from checking a user's
// familyId, so we can display it directly in the app instead of navigating
// Sentry's UI to find it.
export let lastFamilyIdCheck: { uid: string; docExists: boolean; rawData: string } | null = null;

export async function getUserFamilyId(uid: string): Promise<string | null> {
  // Reads directly from the server, bypassing any local cache — rules out
  // a stale cached copy of the user doc (from before familyId was set)
  // being the reason this silently returns null.
  const userSnap = await getDocFromServer(doc(db, 'users', uid));
  const exists = userSnap.exists();
  const rawData = exists ? userSnap.data() : null;
  const familyId = exists ? (rawData?.familyId ?? null) : null;

  lastFamilyIdCheck = { uid, docExists: exists, rawData: JSON.stringify(rawData) };

  if (!familyId) {
    reportError(new Error('getUserFamilyId resolved to null'), {
      uid,
      docExists: exists,
      rawData: JSON.stringify(rawData),
    });
  }

  return familyId;
}

export async function renameFamily(familyId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'families', familyId), { name });
}

/** Removes a member from the family (creator-only action) — clears their familyId too. */
export async function removeMember(familyId: string, memberUid: string): Promise<void> {
  await updateDoc(doc(db, 'families', familyId), { members: arrayRemove(memberUid) });
  await setDoc(doc(db, 'users', memberUid), { familyId: null }, { merge: true });
}

/** A member removing themselves from the family. */
export async function leaveFamily(familyId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'families', familyId), { members: arrayRemove(uid) });
  await setDoc(doc(db, 'users', uid), { familyId: null }, { merge: true });
}

/** Looks up email + display name for a list of member uids, for display
 * in the member list and anywhere a family member's name is shown. */
export async function getMemberProfiles(uids: string[]): Promise<MemberProfile[]> {
  if (uids.length === 0) return [];
  // Firestore 'in' queries cap at 30 values, which comfortably covers a family.
  const q = query(collection(db, 'users'), where(documentId(), 'in', uids.slice(0, 30)));
  const snap = await getDocsCollection(q);
  return snap.docs.map(d => ({ uid: d.id, email: d.data().email || 'Unknown', displayName: d.data().displayName || undefined }));
}

/** Sets the display name shown for this person across the app (calendar,
 * member lists, activity notifications) instead of their email address. */
export async function setDisplayName(uid: string, displayName: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { displayName: displayName.trim() }, { merge: true });
}
