import { Session } from '@supabase/supabase-js';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { fetchMyDevAccess, type DevAccessSnapshot } from '@/lib/dev-access-server';
import { fetchMe, Me } from '@/lib/me';
import { supabase } from '@/lib/supabase';

const EMPTY_DEV_ACCESS: DevAccessSnapshot = { isRoot: false, capabilities: [] };

interface MeContextValue {
  me: Me | null;
  loading: boolean;
  devAccess: DevAccessSnapshot;
  devAccessLoading: boolean;
  /** Re-fetches the current user's me row and updates the shared state so the
   *  root guard re-evaluates (e.g. right after onboarding creates the row). */
  refresh: () => Promise<void>;
}

const MeContext = createContext<MeContextValue>({
  me: null,
  loading: false,
  devAccess: EMPTY_DEV_ACCESS,
  devAccessLoading: false,
  refresh: async () => {},
});

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);
  const [devAccess, setDevAccess] = useState<DevAccessSnapshot>(EMPTY_DEV_ACCESS);
  const [devAccessLoading, setDevAccessLoading] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      const nextId = session?.user.id;
      // Only reset when the user actually changes or signs out — not on
      // token refresh events, which would briefly flip the guard.
      setUserId((prev) => {
        if (prev !== nextId) {
          setMe(null);
          setDevAccess(EMPTY_DEV_ACCESS);
        }
        return nextId;
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setMe(null);
      setLoading(false);
      setDevAccess(EMPTY_DEV_ACCESS);
      setDevAccessLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDevAccessLoading(true);

    fetchMe(userId)
      .then((row) => {
        if (!cancelled) setMe(row);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    fetchMyDevAccess()
      .then((next) => {
        if (!cancelled) setDevAccess(next);
      })
      .catch(() => {
        if (!cancelled) setDevAccess(EMPTY_DEV_ACCESS);
      })
      .finally(() => {
        if (!cancelled) setDevAccessLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const row = await fetchMe(userId);
      setMe(row);
    } catch {
      setMe(null);
    }
    try {
      setDevAccess(await fetchMyDevAccess());
    } catch {
      setDevAccess(EMPTY_DEV_ACCESS);
    }
  }, [userId]);

  return (
    <MeContext.Provider value={{ me, loading, devAccess, devAccessLoading, refresh }}>
      {children}
    </MeContext.Provider>
  );
}

export function useMeContext() {
  return useContext(MeContext);
}
