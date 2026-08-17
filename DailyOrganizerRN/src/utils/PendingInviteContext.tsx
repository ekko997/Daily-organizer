import { createContext, useContext } from 'react';

interface PendingInviteContextValue {
  pendingInviteCode: string | undefined;
  clearPendingInviteCode: () => void;
}

export const PendingInviteContext = createContext<PendingInviteContextValue>({
  pendingInviteCode: undefined,
  clearPendingInviteCode: () => {},
});

export function usePendingInvite() {
  return useContext(PendingInviteContext);
}
