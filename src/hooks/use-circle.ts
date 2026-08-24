import { useCallback, useEffect, useState } from 'react';

import { fetchConnections, removePeer, type Connection } from '@/lib/circle';
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

  const unfriend = useCallback(
    async (peerId: string) => {
      if (!userId) return;
      await removePeer(userId, peerId);
      await refresh();
    },
    [userId, refresh],
  );

  useEffect(() => {
    if (!userId) {
      setConnections([]);
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Build the channel once with all postgres_changes callbacks registered
    // BEFORE subscribe() — never add callbacks to an already-subscribed channel.
    // The cleanup below removes it on unmount / userId change, so a re-render
    // tears down the old subscription instead of re-subscribing the same one.
    channel = supabase
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
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'connections', filter: `user_id=eq.${userId}` },
        () => {
          fetchConnections(userId)
            .then((rows) => {
              if (!cancelled) setConnections(rows);
            })
            .catch(() => {});
        },
      );
    channel.subscribe();

    fetchConnections(userId)
      .then((rows) => {
        if (!cancelled) setConnections(rows);
      })
      .catch(() => {
        if (!cancelled) setConnections([]);
      });

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  return { connections, hasCircle: connections.length > 0, loading, refresh, unfriend };
}
