import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { clearLocalSession, supabase } from '@/lib/supabase';

/**
 * Restores the cached session, then proves the auth user still exists server-
 * side. A deleted account can leave a JWT in AsyncStorage; trusting that alone
 * routes `isAuthed && !hasMe` into onboarding instead of /auth.
 */
async function resolveSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  const cached = data.session;
  if (!cached) return null;

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    await clearLocalSession();
    return null;
  }

  return cached;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    resolveSession().then((next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
