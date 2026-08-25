import type { Check } from '@/lib/checks';
import type { Me } from '@/lib/me';
import { handleFromScannedText } from '@/lib/share-codec';
import { supabase } from '@/lib/supabase';

/**
 * Circle data layer. A connection row is one user's half of a link; the DB
 * mirrors the reverse row on insert, so a single scan/paste (one gate) makes
 * Circle appear for BOTH accounts. Circle only surfaces what is already on the
 * me row and checks table — nothing new is synthesized or stored on ME.
 */

export interface Connection {
  peer_id: string;
  created_at: string;
}

/** The poster fields a connected peer may read (peer_profile RPC). */
export interface PeerMe {
  id: string;
  name: string;
  handle: string;
  show_up: string;
  talk_style: Me['talk_style'];
  recipe: unknown;
}

export interface PeerState {
  me: PeerMe;
  /** The peer's checks, oldest first (latest is last). */
  checks: Check[];
}

export async function fetchConnections(userId: string): Promise<Connection[]> {
  const { data, error } = await supabase
    .from('connections')
    .select('peer_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Connection[];
}

export type AddPeerResult =
  | { ok: true; peer: { id: string; name: string; handle: string } }
  | { ok: false; reason: 'not-found' | 'self' | 'already' | 'error'; message: string };

/**
 * The single gate: resolving a handle to a peer and creating the connection.
 * Inserting one row makes the mirror trigger create the reverse row, so both
 * accounts get the Circle tab from this one event.
 */
export async function addPeerByHandle(raw: string): Promise<AddPeerResult> {
  const handle = handleFromScannedText(raw);
  if (!handle) {
    return { ok: false, reason: 'error', message: "That doesn't look like an @handle or ATO link." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'error', message: 'Not signed in.' };

  const { data: profiles, error: lookupError } = await supabase.rpc('public_profile', {
    p_handle: handle,
  });
  if (lookupError) return { ok: false, reason: 'error', message: lookupError.message };
  const profile = (profiles ?? [])[0] as { id: string; name: string; handle: string } | undefined;
  if (!profile) return { ok: false, reason: 'not-found', message: `No ATO for @${handle} yet.` };

  if (profile.id === user.id) {
    return { ok: false, reason: 'self', message: "That's your own ATO." };
  }

  const { data: existing } = await supabase
    .from('connections')
    .select('peer_id')
    .eq('user_id', user.id)
    .eq('peer_id', profile.id)
    .maybeSingle();
  if (existing) {
    return { ok: false, reason: 'already', message: `${profile.name} is already in your circle.` };
  }

  const { error: insertError } = await supabase
    .from('connections')
    .insert({ user_id: user.id, peer_id: profile.id });
  if (insertError) return { ok: false, reason: 'error', message: insertError.message };

  return { ok: true, peer: { id: profile.id, name: profile.name, handle: profile.handle } };
}

/** Fetches a peer's poster + checks. Requires an existing connection (RLS). */
export async function fetchPeerState(peerId: string): Promise<PeerState | null> {
  try {
    const { data, error } = await supabase.rpc('peer_profile', { p_user_id: peerId });
    if (error) throw error;
    const me = (data ?? [])[0] as PeerMe | undefined;
    if (!me) return null;
    const { data: checkRows, error: checkError } = await supabase
      .from('checks')
      .select('*')
      .eq('user_id', peerId)
      .order('day', { ascending: true });
    if (checkError) throw checkError;
    return { me, checks: (checkRows ?? []) as Check[] };
  } catch {
    return null;
  }
}

/**
 * Unfriend: deletes the caller's edge to the peer. The DB's mirror-delete
 * trigger removes the reverse edge too, so neither side is left with a
 * one-way orphan row. Only the connection is removed — nothing else.
 */
export async function removePeer(userId: string, peerId: string): Promise<void> {
  const { error } = await supabase
    .from('connections')
    .delete()
    .eq('user_id', userId)
    .eq('peer_id', peerId);
  if (error) throw error;
}
