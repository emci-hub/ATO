/**
 * Circle visits — the I/O (hideout roadmap step 6). Rules in `circle-visits.ts`; server in wave97.
 *
 * Every call goes through a wave97 RPC (the phone never reads another account's row itself) and
 * sends at most a friend's id: no look, no text, no counts. Signed out → 'signed_out'; wave97 not
 * applied yet (PostgREST PGRST202) → 'off'; anything else that fails → 'error'. Never throws.
 */
import { supabase } from '@/lib/supabase';
import {
  parseCircleFriends,
  parseCircleInbox,
  parseCircleLook,
  type CircleFriend,
  type CircleGift,
  type CircleLook,
} from '@/play/circle-visits';

export type CircleCall<T> = { kind: 'ok'; value: T } | { kind: 'signed_out' } | { kind: 'off' } | { kind: 'error' };

const MISSING_RE = /PGRST202|Could not find the function/i;

async function call<T>(fn: string, args: Record<string, unknown> | undefined, read: (data: unknown) => T | null): Promise<CircleCall<T>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return { kind: 'signed_out' };
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return MISSING_RE.test(`${error.code ?? ''} ${error.message ?? ''}`) ? { kind: 'off' } : { kind: 'error' };
    const value = read(data);
    return value == null ? { kind: 'error' } : { kind: 'ok', value };
  } catch {
    return { kind: 'error' };
  }
}

export function fetchCircleFriends(): Promise<CircleCall<CircleFriend[]>> {
  return call('circle_visit_friends', undefined, (d) => (Array.isArray(d) ? parseCircleFriends(d) : null));
}

/** Flip my switch for one friend. Ok = { allowed } (both on now). */
export function setCircleShare(peer: string, on: boolean): Promise<CircleCall<{ allowed: boolean }>> {
  return call('set_circle_visit_share', { p_peer: peer, p_on: on }, (d) => {
    const r = d as { ok?: unknown; allowed?: unknown } | null;
    return r && r.ok === true ? { allowed: r.allowed === true } : null;
  });
}

export type CircleRoom = { kind: 'room'; look: CircleLook } | { kind: 'not_allowed' } | { kind: 'no_save' };

export function fetchCircleRoom(peer: string): Promise<CircleCall<CircleRoom>> {
  return call('circle_visit_room', { p_peer: peer }, (d) => {
    const r = d as { ok?: unknown; reason?: unknown; look?: unknown } | null;
    if (!r) return null;
    if (r.ok === true) {
      const look = parseCircleLook(r.look);
      return look ? { kind: 'room', look } : { kind: 'no_save' };
    }
    if (r.reason === 'not_allowed') return { kind: 'not_allowed' };
    if (r.reason === 'no_save') return { kind: 'no_save' };
    return null;
  });
}

export type CircleGiftSent = 'sent' | 'already' | 'not_allowed';

export function sendCircleGift(peer: string): Promise<CircleCall<CircleGiftSent>> {
  return call('circle_send_gift', { p_peer: peer }, (d) => {
    const r = d as { ok?: unknown; already?: unknown; reason?: unknown } | null;
    if (!r) return null;
    if (r.ok === true) return 'sent';
    if (r.already === true) return 'already';
    if (r.reason === 'not_allowed') return 'not_allowed';
    return null;
  });
}

export function fetchCircleInbox(): Promise<CircleCall<CircleGift[]>> {
  return call('circle_gift_inbox', undefined, (d) => (Array.isArray(d) ? parseCircleInbox(d) : null));
}

/** Mark a gift opened on the server (best effort: the phone already remembers the id). */
export async function markCircleGiftOpened(id: string): Promise<void> {
  await call('circle_open_gift', { p_id: id }, (d) => (typeof d === 'boolean' ? d : null));
}
