/**
 * Home's mount payload in one round trip (RPC `home_bootstrap`, wave35).
 *
 * Replaces three separate queries fired on every Home mount — fetchChecks,
 * fetchTraitTracks, and crisisFlagsForWindow. Those still exist and are still
 * the right call from other screens; this is only the Home fast path.
 *
 * Crisis days are folded here, not in SQL, so the local-calendar rule stays in
 * exactly one implementation (`localYmd`) — see the migration comment.
 */
import type { Check } from '@/lib/checks';
import { addDaysYmd, localYmd } from '@/lib/local-date';
import { supabase } from '@/lib/supabase';
import { parseTraitTrackRows } from '@/lib/trait-tracks-store';
import type { TraitTrack } from '@/lib/trait-stability';

export interface HomeBootstrap {
  checks: Check[];
  tracks: TraitTrack[];
  crisisToday: boolean;
  crisisYesterday: boolean;
}

export const EMPTY_HOME_BOOTSTRAP: HomeBootstrap = {
  checks: [],
  tracks: [],
  crisisToday: false,
  crisisYesterday: false,
};

/** Same fold as crisisFlagsForWindow, over timestamps the RPC already scoped. */
export function crisisFlagsFromTimestamps(
  timestamps: readonly string[],
  timeZone: string,
  now = new Date(),
): { crisisToday: boolean; crisisYesterday: boolean } {
  const today = localYmd(now, timeZone || 'UTC');
  const yesterday = addDaysYmd(today, -1);
  const days = new Set(timestamps.map((at) => localYmd(new Date(at), timeZone || 'UTC')));
  return { crisisToday: days.has(today), crisisYesterday: days.has(yesterday) };
}

export async function fetchHomeBootstrap(
  timeZone: string,
  now = new Date(),
): Promise<HomeBootstrap> {
  const { data, error } = await supabase.rpc('home_bootstrap');
  if (error) throw error;

  const row = (data ?? {}) as {
    checks?: unknown;
    trait_tracks?: unknown;
    crisis_since?: unknown;
  };

  const checks = Array.isArray(row.checks) ? (row.checks as Check[]) : [];
  const tracks = parseTraitTrackRows(Array.isArray(row.trait_tracks) ? row.trait_tracks : []);
  const timestamps = Array.isArray(row.crisis_since)
    ? row.crisis_since.filter((at): at is string => typeof at === 'string')
    : [];

  return { checks, tracks, ...crisisFlagsFromTimestamps(timestamps, timeZone, now) };
}
