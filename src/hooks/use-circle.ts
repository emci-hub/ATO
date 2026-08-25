import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { fetchConnections, removePeer, type Connection } from '@/lib/circle';
import { supabase } from '@/lib/supabase';

/**
 * The user's circle. Drives the conditional Circle tab: it appears only once a
 * connection exists (a scan or pasted link — one gate). Subscribes to realtime
 * so the tab appears on the other device without a manual refresh.
 *
 * Realtime is the fast path, but not the only one: a missed INSERT during a
 * remount (the `hidden` tab toggle remounts the navigator) or a dropped
 * websocket would leave `hasCircle` stale. So we also refetch on app
 * foreground, and callers refetch after a successful add/unfriend.
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

    const load = () =>
      fetchConnections(userId)
        .then((rows) => {
          if (!cancelled) setConnections(rows);
        })
        .catch(() => {});

    // Build the channel once with all postgres_changes callbacks registered
    // BEFORE subscribe() — never add callbacks to an already-subscribed channel.
    // The cleanup below removes it on unmount / userId change, so a re-render
    // tears down the old subscription instead of re-subscribing the same one.
    channel = supabase
      .channel(`circle:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'connections', filter: `user_id=eq.${userId}` },
        load,
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'connections', filter: `user_id=eq.${userId}` },
        load,
      );
    channel.subscribe();

    // Initial fetch.
    load();

    // Refetch on app foreground: realtime websockets can drop or the channel
    // can re-create during a remount; a foreground refetch self-heals a stale
    // `hasCircle` (e.g. a re-add that happened while the app was backgrounded).
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });

    return () => {
      cancelled = true;
      sub.remove();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  return { connections, hasCircle: connections.length > 0, loading, refresh, unfriend };
}
