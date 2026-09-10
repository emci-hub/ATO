/**
 * Top-level roll runner (trait-system redesign §7) — ties eligibility,
 * quota, composition, and storage together. This is the real entry point a
 * screen/route calls; everything it calls is already independently pure
 * (rollEligible, composeRoll) or a thin RPC wrapper (store.ts).
 */
import * as Crypto from 'expo-crypto';

import type { LegendValues } from '@/lib/legends64/classify';
import type { TraitTrack } from '@/lib/trait-stability';

import { composeRoll, rollEligible } from './compose';
import { generateRollItemText } from './generate';
import { claimRoll, fetchLastRollSnapshot, storeRoll } from './store';

export type RunRollOutcome =
  | { kind: 'not_eligible' }
  | { kind: 'quota'; daily: number; dailyCap: number }
  | { kind: 'stored'; rollId: string; already: boolean }
  | { kind: 'error'; message: string };

function claimFailureOutcome(claim: { reason?: string; daily?: number; dailyCap?: number }): RunRollOutcome {
  if (claim.reason === 'quota') {
    return { kind: 'quota', daily: claim.daily ?? 0, dailyCap: claim.dailyCap ?? 0 };
  }
  return { kind: 'error', message: `claim_roll failed: ${claim.reason ?? 'unknown'}` };
}

/**
 * Runs one full roll attempt: checks RCI eligibility against the last
 * stored snapshot, claims the daily roll-composition backstop, generates
 * the legend + 11 category reads + story, and stores them atomically.
 *
 * Eligibility (rollEligible) runs HERE, in client code, before claimRoll —
 * NOT server-enforced. §7 states rolling should be "gated server-side...
 * never trusted from the client," which this does not fully satisfy: a
 * modified client could skip the eligibility check and call claimRoll()
 * directly. This is a known, accepted gap for now (flagged in review, not
 * silently missed) — the actual AI-cost exposure it could open is still
 * hard-bounded by two independent server-side RPCs regardless of whether
 * eligibility was honestly evaluated: claimRoll() (rolls_daily_cap, 1
 * composition/day) and claimRollGeneration() (roll_generations_daily_cap,
 * wave48, ~15 generations/day) inside generateRollItemText. Closing this
 * properly means moving the eligibility check into a real Edge Function
 * (mirroring ai-generate's JWT-verified, server-side pattern) — deferred
 * rather than built speculatively, since Edge Function changes can't be
 * tested against a live Postgres in this environment (no Supabase branching
 * on the current plan) and this repo already accepts the same trust
 * model — client-trusted, hard-bounded by a real cap — for other
 * idempotent-but-unverified actions like claim_intake_complete.
 */
export async function runRoll(
  userId: string,
  tracks: readonly TraitTrack[],
  values: LegendValues,
): Promise<RunRollOutcome> {
  // Wrapped end to end: found in review that claimRollGeneration (inside
  // composeRoll's per-item generation) threw on any RPC error rather than
  // degrading gracefully — fixed at that layer too (generate.ts), but this
  // outer wrap is the real backstop. Any unexpected failure anywhere in
  // this chain (network blip, an RPC not yet applied, storeRoll rejecting a
  // malformed payload) must degrade to a clean {kind:'error'}, never an
  // uncaught throw — especially since claimRoll below may have already
  // spent the day's 1/day composition attempt by the time a later step
  // fails.
  try {
    const lastSnapshot = await fetchLastRollSnapshot(userId);
    if (!rollEligible(tracks, lastSnapshot)) {
      return { kind: 'not_eligible' };
    }

    const claim = await claimRoll();
    if (!claim.ok) {
      return claimFailureOutcome(claim);
    }

    const { items, snapshot } = await composeRoll(tracks, values, {
      generateRollText: generateRollItemText,
    });

    const rollId = Crypto.randomUUID();
    const stored = await storeRoll(rollId, items, snapshot);
    if (!stored.ok) {
      return { kind: 'error', message: 'store_roll failed' };
    }
    return { kind: 'stored', rollId, already: stored.already ?? false };
  } catch (err) {
    console.log('[rolls] runRoll error:', err);
    const message = err instanceof Error ? err.message : 'unknown runRoll error';
    return { kind: 'error', message };
  }
}
