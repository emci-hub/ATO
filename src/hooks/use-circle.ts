import { useCallback, useEffect, useRef, useState } from 'react';
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
      const rows = await fetchConnections(userId);
      // TEMP-DIAG: log hasCircle transition
      console.log(`[circle-diag] refresh(${userId}) → ${rows.length} conn(s)`);
      setConnections(rows);
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
          // TEMP-DIAG: log realtime-triggered loads distinctly
          console.log(`[circle-diag] realtime/init load(${userId}) → ${rows.length} conn(s)`);
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
        (payload) => {
          // TEMP-DIAG: log the realtime INSERT event
          console.log('[circle-diag] REALTIME INSERT event', JSON.stringify(payload.new));
          load();
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'connections', filter: `user_id=eq.${userId}` },
        (payload) => {
          // TEMP-DIAG: log the realtime DELETE event
          console.log('[circle-diag] REALTIME DELETE event', JSON.stringify(payload.old));
          load();
        },
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

  const hasCircle = connections.length > 0;
  // TEMP-DIAG: log hasCircle transitions
  const prev = useRef(hasCircle);
  useEffect(() => {
    if (prev.current !== hasCircle) {
      console.log(`[circle-diag] hasCircle ${prev.current} → ${hasCircle}`);
      prev.current = hasCircle;
    }
  }, [hasCircle]);

  return { connections, hasCircle, loading, refresh, unfriend };
}
