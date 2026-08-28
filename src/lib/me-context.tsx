import { Session } from '@supabase/supabase-js';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { fetchMe, Me } from '@/lib/me';
import { supabase } from '@/lib/supabase';

interface MeContextValue {
  me: Me | null;
  loading: boolean;
  /** Re-fetches the current user's me row and updates the shared state so the
   *  root guard re-evaluates (e.g. right after onboarding creates the row). */
  refresh: () => Promise<void>;
}

const MeContext = createContext<MeContextValue>({
  me: null,
  loading: false,
  refresh: async () => {},
});

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);
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
        if (prev !== nextId) setMe(null);
        return nextId;
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setMe(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

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
  }, [userId]);

  return <MeContext.Provider value={{ me, loading, refresh }}>{children}</MeContext.Provider>;
}

export function useMeContext() {
  return useContext(MeContext);
}
