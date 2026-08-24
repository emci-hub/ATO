import { useCallback, useEffect, useState } from 'react';

import { fetchMe, Me } from '@/lib/me';

export function useMe(userId: string | undefined) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);

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

  // Lets the caller tell us the row now exists (e.g. right after onboarding
  // creates it) so the root guard re-evaluates and navigation happens
  // declaratively instead of racing an imperative router.replace.
  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const row = await fetchMe(userId);
      setMe(row);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { me, loading, refresh };
}
