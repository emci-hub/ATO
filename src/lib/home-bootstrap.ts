/**
 * Home's mount payload in one round trip (RPC `home_bootstrap`, wave35).
 *
 * Replaces separate queries fired on every Home mount — fetchChecks and
 * fetchTraitTracks. Those still exist and are still the right call from other
 * screens; this is only the Home fast path.
 *
 * Until wave103 is applied the RPC may still send an extra field from the
 * removed crisis system; the app ignores any field it does not name here.
 */
import type { Check } from '@/lib/checks';
import { supabase } from '@/lib/supabase';
import { attachAnswerSamples, fetchTraitAnswerSamples, parseTraitTrackRows } from '@/lib/trait-tracks-store';
import type { TraitTrack } from '@/lib/trait-stability';

export interface HomeBootstrap {
  checks: Check[];
  tracks: TraitTrack[];
}

export const EMPTY_HOME_BOOTSTRAP: HomeBootstrap = {
  checks: [],
  tracks: [],
};

/**
 * `timeZone` is kept so callers do not change; the payload no longer needs it.
 */
export async function fetchHomeBootstrap(_timeZone?: string): Promise<HomeBootstrap> {
  const { data, error } = await supabase.rpc('home_bootstrap');
  if (error) throw error;

  const row = (data ?? {}) as {
    checks?: unknown;
    trait_tracks?: unknown;
  };

  const checks = Array.isArray(row.checks) ? (row.checks as Check[]) : [];
  const parsed = parseTraitTrackRows(Array.isArray(row.trait_tracks) ? row.trait_tracks : []);
  let userId: string | undefined;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id;
  } catch {
    userId = undefined;
  }
  const tracks = userId ? attachAnswerSamples(parsed, await fetchTraitAnswerSamples(userId)) : parsed;

  return { checks, tracks };
}
