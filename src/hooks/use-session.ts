import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { devTestAutoSignIn } from '@/lib/dev-test-user';
import { clearLocalSession, supabase } from '@/lib/supabase';

/**
 * Restores the cached session, then proves the auth user still exists server-
 * side. A deleted account can leave a JWT in AsyncStorage; trusting that alone
 * routes `isAuthed && !hasMe` into onboarding instead of /auth.
 *
 * Dev builds (__DEV__ only) auto-sign in as the fixed dev-test user
 * (@atodev) when no session is cached at cold start — no Apple prompt, no
 * OTP email. A real account already signed in on the dev build is never
 * overridden; a mid-session sign-out lands on the normal auth screen, and the
 * next cold start auto-signs back in. The auto sign-in is fail-closed (see
 * dev-test-user.ts), so a broken dev account lands on the normal auth screen.
 */
async function resolveSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session && __DEV__) {
    await devTestAutoSignIn();
  }

  const { data: afterAutoLogin } = await supabase.auth.getSession();
  const cached = afterAutoLogin.session;
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
