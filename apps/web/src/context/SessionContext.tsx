import type { EventMode, SessionStatusDto } from '@wedding/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  changeEventMode,
  fetchSessionStatus,
  loginModerator,
  logoutModerator,
  updateGuestAlias,
} from '../lib/api.js';

interface SessionContextValue {
  session: SessionStatusDto;
  loading: boolean;
  refreshSession: () => Promise<void>;
  saveAlias: (alias: string) => Promise<SessionStatusDto>;
  setLocalAlias: (alias: string) => void;
  unlockModerator: (pin: string) => Promise<SessionStatusDto>;
  exitModerator: () => Promise<void>;
  updateMode: (mode: EventMode) => Promise<void>;
}

const DEFAULT_SESSION: SessionStatusDto = {
  hasGateAccess: true,
  alias: null,
  isModerator: false,
  eventMode: 'live',
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionStatusDto>(DEFAULT_SESSION);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await fetchSessionStatus();
      setSession(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const saveAlias = useCallback(async (alias: string) => {
    const updated = await updateGuestAlias(alias);
    setSession(updated);
    return updated;
  }, []);

  const setLocalAlias = useCallback((alias: string) => {
    setSession((prev) => ({ ...prev, alias }));
  }, []);

  const unlockModerator = useCallback(async (pin: string) => {
    const updated = await loginModerator(pin);
    setSession(updated);
    return updated;
  }, []);

  const exitModerator = useCallback(async () => {
    await logoutModerator();
    setSession((prev) => ({ ...prev, isModerator: false }));
  }, []);

  const updateMode = useCallback(async (mode: EventMode) => {
    const res = await changeEventMode(mode);
    setSession((prev) => ({ ...prev, eventMode: res.mode }));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      loading,
      refreshSession,
      saveAlias,
      setLocalAlias,
      unlockModerator,
      exitModerator,
      updateMode,
    }),
    [
      session,
      loading,
      refreshSession,
      saveAlias,
      setLocalAlias,
      unlockModerator,
      exitModerator,
      updateMode,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return ctx;
}
