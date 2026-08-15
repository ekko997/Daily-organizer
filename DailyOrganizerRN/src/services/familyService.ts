import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface FamilyDoc {
  id: string;
  name: string;
  inviteCode: string;
  members: string[];
  createdBy: string;
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
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const familyDoc = snap.docs[0];
  await updateDoc(familyDoc.ref, { members: arrayUnion(uid) });
  await setDoc(doc(db, 'users', uid), { familyId: familyDoc.id }, { merge: true });
  return { id: familyDoc.id, ...(familyDoc.data() as any) };
}

export async function getUserFamilyId(uid: string): Promise<string | null> {
  const userSnap = await getDoc(doc(db, 'users', uid));
  return userSnap.exists() ? (userSnap.data().familyId ?? null) : null;
}

export async function renameFamily(familyId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'families', familyId), { name });
}
