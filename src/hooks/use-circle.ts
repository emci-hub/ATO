import { useCallback, useEffect, useState } from 'react';

import { fetchConnections, type Connection } from '@/lib/circle';
import { supabase } from '@/lib/supabase';

/**
 * The user's circle. Drives the conditional Circle tab: it appears only once a
 * connection exists (a scan or pasted link — one gate). Subscribes to realtime
 * so the tab appears on the other device without a manual refresh.
 */
export function useCircle(userId: string | undefined) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setConnections([]);
      return;
    }
    setLoading(true);
    try {
      setConnections(await fetchConnections(userId));
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setConnections([]);
      return;
    }

    let cancelled = false;
    fetchConnections(userId)
      .then((rows) => {
        if (!cancelled) setConnections(rows);
      })
      .catch(() => {
        if (!cancelled) setConnections([]);
      });

    const channel = supabase
      .channel(`circle:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'connections', filter: `user_id=eq.${userId}` },
        () => {
          fetchConnections(userId)
            .then((rows) => {
              if (!cancelled) setConnections(rows);
            })
            .catch(() => {});
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { connections, hasCircle: connections.length > 0, loading, refresh };
}
