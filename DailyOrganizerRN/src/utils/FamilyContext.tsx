import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import {
  createFamily as createFamilyService,
  joinFamily as joinFamilyService,
  getUserFamilyId,
  renameFamily as renameFamilyService,
  FamilyDoc,
} from '../services/familyService';

interface FamilyContextValue {
  family: FamilyDoc | null;
  loading: boolean;
  loadError: string | null;
  createFamily: (name: string) => Promise<void>;
  joinFamily: (code: string) => Promise<boolean>;
  renameFamily: (name: string) => Promise<void>;
}

const FamilyContext = createContext<FamilyContextValue>({
  family: null,
  loading: true,
  loadError: null,
  createFamily: async () => {},
  joinFamily: async () => false,
  renameFamily: async () => {},
});

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [family, setFamily] = useState<FamilyDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setFamilyId(null);
      setFamily(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    getUserFamilyId(user.uid)
      .then(id => {
        setFamilyId(id);
        if (!id) setLoading(false);
      })
      .catch(err => {
        setLoadError(err?.message ?? 'Failed to load account data.');
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!familyId) return;
    const unsubscribe = onSnapshot(
      doc(db, 'families', familyId),
      snap => {
        if (snap.exists()) setFamily({ id: snap.id, ...(snap.data() as any) });
        setLoading(false);
      },
      err => {
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

  return (
    <FamilyContext.Provider value={{ family, loading, loadError, createFamily, joinFamily, renameFamily }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  return useContext(FamilyContext);
}
