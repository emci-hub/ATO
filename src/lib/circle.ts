import type { Me } from '@/lib/me';
import type { CheckStatus } from '@/lib/voice/types';
import { handleFromScannedText } from '@/lib/share-codec';
import { supabase } from '@/lib/supabase';

/**
 * Circle data layer. A connection row is one user's half of a link; the DB
 * mirrors the reverse row on insert, so a single scan/paste (one gate) makes
 * Circle appear for BOTH accounts. Circle only surfaces what is already on the
 * me row and the peer_checks RPC (Read/Do/status/day) — never the checks table
 * itself, so nudge_text cannot appear in a peer response.
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

/** Columns peer_checks returns. No nudge_text, source, or logged_on. */
export interface PeerCheck {
  day: number;
  status: CheckStatus;
  read_text: string | null;
  do_text: string | null;
}

export interface PeerState {
  me: PeerMe;
  /** The peer's checks, oldest first (latest is last). */
  checks: PeerCheck[];
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
 * Step 1 of the Circle connect gate: resolves a scanned/pasted handle to a
 * public profile. Never writes a connection — the caller must show the
 * resolved name/handle and get an explicit "Add" tap before confirmAddPeer.
 */
export async function resolvePeerByHandle(raw: string): Promise<AddPeerResult> {
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

  return { ok: true, peer: { id: profile.id, name: profile.name, handle: profile.handle } };
}

/**
 * Step 2: the explicit "Add to Circle" tap after resolvePeerByHandle showed
 * who this is — the actual connection write. Re-checks self/already so a
 * stale resolve (the peer got added from another device meanwhile, say)
 * cannot double-insert. Inserting one row makes the mirror trigger create
 * the reverse row, so both accounts get the Circle tab from this one event.
 */
export async function confirmAddPeer(
  peer: { id: string; name: string; handle: string },
): Promise<AddPeerResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'error', message: 'Not signed in.' };

  if (peer.id === user.id) {
    return { ok: false, reason: 'self', message: "That's your own ATO." };
  }

  // wave104: no direct insert. The server checks blocks, the cap and the rate limit, and either
  // sends a request or (if they had already asked) accepts it.
  const { data, error } = await supabase.rpc('circle_request', { p_handle: peer.handle });
  if (error) return { ok: false, reason: 'error', message: error.message };
  const r = data as { ok?: boolean; state?: string; reason?: string } | null;
  if (r?.ok === true) return { ok: true, peer };
  switch (r?.reason) {
    case 'self':
      return { ok: false, reason: 'self', message: "That's your own ATO." };
    case 'already':
    case 'pending':
      return { ok: false, reason: 'already', message: `${peer.name} is already in your circle or waiting.` };
    case 'not_found':
      return { ok: false, reason: 'not-found', message: `No ATO for @${peer.handle} yet.` };
    case 'cap':
      return { ok: false, reason: 'error', message: 'Circle is full.' };
    case 'rate_limited':
      return { ok: false, reason: 'error', message: 'Too many tries. Try again later.' };
    default:
      return { ok: false, reason: 'error', message: "Can't send that one." };
  }
}

/**
 * Fetches a peer's poster + peer_checks. Requires an existing connection.
 * Note (wave104): the server now returns nothing for `peer_profile` / `peer_checks`, so this
 * resolves to null; the Play Circle sheet is the live Circle UI.
 */
export async function fetchPeerState(peerId: string): Promise<PeerState | null> {
  try {
    const { data, error } = await supabase.rpc('peer_profile', { p_user_id: peerId });
    if (error) throw error;
    const me = (data ?? [])[0] as PeerMe | undefined;
    if (!me) return null;
    const { data: checkRows, error: checkError } = await supabase.rpc('peer_checks', {
      p_user_id: peerId,
    });
    if (checkError) throw checkError;
    return { me, checks: (checkRows ?? []) as PeerCheck[] };
  } catch {
    return null;
  }
}

/**
 * Unfriend through the server (wave104 `circle_remove`): it drops both edges; old sharing
 * switches stop counting (they must be set again after a new friendship). `_userId` is kept so existing callers compile; the server uses the signed-in account.
 */
export async function removePeer(_userId: string, peerId: string): Promise<void> {
  const { data, error } = await supabase.rpc('circle_remove', { p_peer: peerId });
  if (error) throw error;
  if ((data as { ok?: boolean } | null)?.ok !== true) throw new Error('Could not remove that person.');
}
