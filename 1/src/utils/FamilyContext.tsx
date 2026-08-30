import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { reportError } from '../services/errorReporting';
import { useAuth } from './AuthContext';
import {
  createFamily as createFamilyService,
  joinFamily as joinFamilyService,
  getUserFamilyId,
  renameFamily as renameFamilyService,
  removeMember as removeMemberService,
  leaveFamily as leaveFamilyService,
  getMemberProfiles,
  FamilyDoc,
  MemberProfile,
} from '../services/familyService';

interface FamilyContextValue {
  family: FamilyDoc | null;
  members: MemberProfile[];
  loading: boolean;
  loadError: string | null;
  retryLoad: () => void;
  createFamily: (name: string) => Promise<void>;
  joinFamily: (code: string) => Promise<boolean>;
  renameFamily: (name: string) => Promise<void>;
  removeMember: (uid: string) => Promise<void>;
  leaveFamily: () => Promise<void>;
  // Temporary diagnostic — the raw familyId the context resolved internally,
  // even when the actual family document failed to load. Lets us tell apart
  // "never found a familyId" from "found one but couldn't load the family."
  debugFamilyId: string | null;
}

const FamilyContext = createContext<FamilyContextValue>({
  family: null,
  members: [],
  loading: true,
  loadError: null,
  retryLoad: () => {},
  createFamily: async () => {},
  joinFamily: async () => false,
  renameFamily: async () => {},
  removeMember: async () => {},
  leaveFamily: async () => {},
  debugFamilyId: null,
});

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [family, setFamily] = useState<FamilyDoc | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  function retryLoad() {
    setRetryCounter(c => c + 1);
  }

  useEffect(() => {
    if (!user) {
      setFamilyId(null);
      setFamily(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    let settled = false;
    let cancelled = false;

    // Firestore can occasionally hang with no error and no result on some
    // networks — this guarantees the screen never gets stuck indefinitely.
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setLoadError('This is taking too long. Check your internet connection and try again.');
        setLoading(false);
      }
    }, 10000);

    function attempt(isRetry: boolean) {
      getUserFamilyId(user!.uid)
        .then(id => {
          if (settled || cancelled) return;
          if (!id && !isRetry) {
            // A cold app launch can occasionally get a stale/incomplete read
            // on the very first Firestore call, before everything's fully
            // warmed up — even though the data itself is correct (confirmed:
            // a manual refresh moments later always finds it). One quick
            // silent retry catches this automatically, matching what a
            // manual refresh does, without the person needing to know that.
            setTimeout(() => { if (!settled && !cancelled) attempt(true); }, 1500);
            return;
          }
          settled = true;
          clearTimeout(timeout);
          setFamilyId(id);
          if (!id) setLoading(false);
        })
        .catch(err => {
          if (settled || cancelled) return;
          // A cold app start can hit a transient network hiccup on the very
          // first Firestore call — one silent retry clears most of these
          // without the person ever seeing an error for something that
          // resolves itself half a second later.
          if (!isRetry) {
            setTimeout(() => { if (!settled && !cancelled) attempt(true); }, 1200);
            return;
          }
          settled = true;
          clearTimeout(timeout);
          setLoadError(err?.message ?? 'Failed to load account data.');
          setLoading(false);
        });
    }
    attempt(false);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user?.uid, retryCounter]);

  useEffect(() => {
    if (!familyId) {
      setFamily(null);
      setMembers([]);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'families', familyId),
      async snap => {
        if (snap.exists()) {
          const data = { id: snap.id, ...(snap.data() as any) } as FamilyDoc;
          setFamily(data);
          try {
            setMembers(await getMemberProfiles(data.members));
          } catch {
            // Non-fatal — the family itself still loaded fine even if member
            // emails fail to fetch for some reason.
          }
        } else {
          // We have a familyId but the document isn't there when we look —
          // captured so we can actually see this happen instead of guessing.
          reportError(new Error('Family document not found for known familyId'), { familyId, uid: user?.uid });
        }
        setLoading(false);
      },
      err => {
        reportError(err, { context: 'family onSnapshot error', familyId, uid: user?.uid });
        setLoadError(err?.message ?? 'Failed to load family data.');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [familyId]);

  const createFamily = useCallback(async (name: string) => {
    if (!user) return;
    const f = await createFamilyService(user.uid, name);
    setFamilyId(f.id);
  }, [user]);

  const joinFamily = useCallback(async (code: string) => {
    if (!user) return false;
    const f = await joinFamilyService(user.uid, code);
    if (f) {
      setFamilyId(f.id);
      return true;
    }
    return false;
  }, [user]);

  const renameFamily = useCallback(async (name: string) => {
    if (!familyId) return;
    await renameFamilyService(familyId, name);
  }, [familyId]);

  const removeMember = useCallback(async (uid: string) => {
    if (!familyId) return;
    await removeMemberService(familyId, uid);
  }, [familyId]);

  const leaveFamily = useCallback(async () => {
    if (!familyId || !user) return;
    await leaveFamilyService(familyId, user.uid);
    setFamilyId(null);
    setFamily(null);
    setMembers([]);
  }, [familyId, user]);

  return (
    <FamilyContext.Provider value={{ family, members, loading, loadError, retryLoad, createFamily, joinFamily, renameFamily, removeMember, leaveFamily, debugFamilyId: familyId }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  return useContext(FamilyContext);
}
