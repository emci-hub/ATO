/**
 * Circle compare — the I/O (master plan Step 7b). Rules + copy in `circle-compare.ts`; server in wave105.
 * Sends at most a friend's id and a switch; gets back keys the rules file turns into fixed phrases.
 * Never throws. wave105 not applied yet (PGRST202) → 'off'.
 */
import { supabase } from '@/lib/supabase';
import { parseCompareCard, parseCompareList, type CircleCompareCard, type CircleCompareList } from '@/play/circle-compare';
import type { CircleCall } from '@/play/circle-visits-store';

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

export function fetchCompareList(): Promise<CircleCall<CircleCompareList>> {
  return call('circle_compare_friends', undefined, parseCompareList);
}

/** Flip my compare switch for one friend. Ok = { allowed } (both on now). */
export function setCompareShare(peer: string, on: boolean): Promise<CircleCall<{ allowed: boolean }>> {
  return call('set_circle_compare_share', { p_peer: peer, p_on: on }, (d) => {
    const r = d as { ok?: unknown; allowed?: unknown } | null;
    return r && r.ok === true ? { allowed: r.allowed === true } : null;
  });
}

/** The card, or `null` value-kind 'not_allowed' when a switch is off on either side. */
export function fetchCompareCard(peer: string): Promise<CircleCall<CircleCompareCard | 'not_allowed'>> {
  return call('circle_compare', { p_peer: peer }, (d) => {
    const r = d as { ok?: unknown; reason?: unknown } | null;
    if (r && r.ok === false && r.reason === 'not_allowed') return 'not_allowed' as const;
    return parseCompareCard(d);
  });
}
