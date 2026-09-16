/**
 * Offline checks for the bank-pool prewarm (wave68).
 *
 * Two halves:
 *  - pure threshold logic (`axesBelowReserve`, `reserveTargetFor`), tested
 *    directly, the same way tiered-axis-plan-check.ts tests its plan;
 *  - static source assertions on the wiring, since `prewarmBankPool` and its
 *    call site touch Supabase/AI and can't run here — the load-bearing facts
 *    are that the trigger is fire-and-forget AFTER the round is served, and
 *    that prewarm writes to the shared bank only, never to per-user rows.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';
import { AXIS_TIER_COUNTS } from '../src/lib/questions/tiered-axis-plan';
import {
  axesBelowReserve,
  reserveTargetFor,
  PREWARM_MAX_QUESTIONS,
  RESERVE_ROUNDS,
} from '../src/lib/questions/prewarm';

let passed = 0;
function ok(label: string): void {
  console.log(`  ✓ ${label}`);
  passed += 1;
}

function read(rel: string): string {
  return readFileSync(resolve(__dirname, '..', rel), 'utf8');
}

/** A depth map that is exactly at reserve for every axis — the "nothing to do" baseline. */
function fullDepth(): Partial<Record<TraitAxis, number>> {
  const out: Partial<Record<TraitAxis, number>> = {};
  for (const axis of TRAIT_AXES) out[axis] = reserveTargetFor(axis);
  return out;
}

// --- pure threshold logic ----------------------------------------------------

for (const axis of TRAIT_AXES) {
  assert.equal(reserveTargetFor(axis), AXIS_TIER_COUNTS[axis] * RESERVE_ROUNDS);
}
ok('reserveTargetFor is that axis’s per-round demand × RESERVE_ROUNDS, for every axis');

assert.deepEqual(axesBelowReserve(fullDepth()), {});
ok('a pool at reserve on every axis asks for no generation at all');

{
  const depth = fullDepth();
  depth.playfulness = reserveTargetFor('playfulness') - 1;
  const wanted = axesBelowReserve(depth);
  assert.deepEqual(wanted, { playfulness: 1 });
}
ok('one axis one short asks for exactly one question, on that axis only');

{
  // The case that matters most: bank_pool_depth omits an axis entirely when
  // it has no usable rows left, so an ABSENT axis must read as 0 (fully
  // short), not be skipped. Getting this backwards would silently disable
  // prewarm for exactly the axis that has run out.
  const depth = fullDepth();
  delete depth.playfulness;
  const wanted = axesBelowReserve(depth);
  assert.equal(wanted.playfulness, reserveTargetFor('playfulness'));
}
ok('an axis MISSING from the depth map is treated as 0 (fully short), never skipped');

{
  // Empty pool: every axis is fully short, so the cap is what bounds the ask.
  const wanted = axesBelowReserve({});
  const total = Object.values(wanted).reduce((sum, n) => sum + (n ?? 0), 0);
  assert.equal(total, PREWARM_MAX_QUESTIONS, 'a cold pool must spend exactly the cap, not the whole shortfall');
  assert.ok(
    Object.values(wanted).every((n) => (n ?? 0) > 0),
    'no axis may appear with a zero count',
  );
}
ok('a totally empty pool is capped at PREWARM_MAX_QUESTIONS, not the full shortfall');

{
  // Budget goes to the axis closest to running out, not to whichever axis
  // happens to sort first.
  const depth = fullDepth();
  depth.openness = reserveTargetFor('openness') - 1; // short by 1
  depth.playfulness = 0; // short by its whole target
  const wanted = axesBelowReserve(depth, 2);
  assert.equal(wanted.playfulness, 2, 'the deepest shortfall must take the budget first');
  assert.equal(wanted.openness, undefined, 'a shallower shortfall must not consume a spent budget');
}
ok('a capped pass spends its budget deepest-shortfall-first');

{
  assert.deepEqual(axesBelowReserve({}, 0), {}, 'a zero budget must ask for nothing');
  assert.deepEqual(axesBelowReserve({}, -5), {}, 'a negative budget must not be treated as unlimited');
}
ok('a zero or negative budget asks for nothing rather than generating unbounded');

assert.ok(
  PREWARM_MAX_QUESTIONS > 0 && PREWARM_MAX_QUESTIONS <= 25,
  'the per-pass cap must be positive and never exceed a whole round',
);
ok('PREWARM_MAX_QUESTIONS is a sane per-pass cost ceiling');

// --- wiring ------------------------------------------------------------------

const runSrc = read('src/lib/questions/run-prewarm.ts');

assert.match(runSrc, /addToBankPool/, 'prewarm must write into the shared bank pool');
assert.doesNotMatch(
  runSrc,
  /saveOngoingRoundBatch|insert_ongoing_round_pack|answerQuestionItem/,
  'prewarm must never create per-user pack/item rows — it only tops up the shared bank',
);
ok('prewarm persists to the shared bank pool only, never to per-user packs or items');

assert.match(runSrc, /let inFlight = false/, 'an in-process guard is required');
assert.match(runSrc, /if \(inFlight\) return;/, 'the guard must short-circuit re-entry');
ok('prewarm is guarded against concurrent passes within one app process');

{
  // The cooldown must be stamped BEFORE generating: a pass that dies halfway
  // has still spent AI calls and must not be retried on the next round-start.
  const stampAt = runSrc.indexOf('AsyncStorage.setItem(COOLDOWN_KEY');
  // The CALL site, not the import line at the top of the file.
  const generateAt = runSrc.indexOf('await fillAxisCountsChunked(');
  assert.ok(stampAt > 0 && generateAt > 0, 'both the cooldown stamp and the generate call must exist');
  assert.ok(stampAt < generateAt, 'the cooldown must be stamped before generation, not after');
}
ok('the cooldown is stamped before generation, so a failed pass cannot immediately retry');

assert.match(
  runSrc,
  /catch \(err\) \{\s*\n\s*console\.log\('\[questions\] prewarm error:'/,
  'prewarm must swallow its own failures',
);
ok('prewarm never throws into its caller — a failed top-up must not break a live round');

const foldSrc = read('src/components/questions-fold.tsx');

{
  const startAt = foldSrc.indexOf('const saved = await withTimeout(runOngoingRound(');
  assert.ok(startAt > 0, 'the round-start call must exist');
  const setPackAt = foldSrc.indexOf('setPack(saved);', startAt);
  const prewarmAt = foldSrc.indexOf('void prewarmBankPool(', startAt);
  assert.ok(setPackAt > 0 && prewarmAt > 0, 'both setPack and the prewarm trigger must exist');
  assert.ok(
    setPackAt < prewarmAt,
    'prewarm must fire AFTER the round is handed to the user, never before',
  );
  assert.match(
    foldSrc.slice(startAt, prewarmAt + 40),
    /void prewarmBankPool\(/,
    'prewarm must be fire-and-forget (void), never awaited on the round-start path',
  );
  assert.doesNotMatch(
    foldSrc.slice(startAt, prewarmAt + 60),
    /await prewarmBankPool\(/,
    'awaiting prewarm would reintroduce the latency it exists to remove',
  );
}
ok('the round-start path fires prewarm after serving the round, unawaited');

// --- the dedup half of wave68 ------------------------------------------------

const bankSrc = read('src/lib/questions/bank-pool.ts');
assert.match(bankSrc, /supabase\.rpc\('fetch_bank_candidates'/, 'candidates must come from the wave68 RPC');
assert.doesNotMatch(
  bankSrc,
  /from\('question_bank_pool'\)/,
  'the direct table select cannot come back — it could not anti-join the answer history',
);
ok('fetchBankCandidates draws through fetch_bank_candidates, not a direct table select');

const migration = read('supabase/migrations/wave68_bank_pool_dedup_and_depth.sql');
for (const fn of ['fetch_bank_candidates', 'bank_pool_depth']) {
  assert.match(migration, new RegExp(`create or replace function public\\.${fn}`));
  assert.match(migration, new RegExp(`grant execute on function public\\.${fn}[^;]*to authenticated`));
  assert.match(migration, new RegExp(`revoke all on function public\\.${fn}[^;]*from public, anon`));
}
ok('both wave68 functions are security-definer, granted to authenticated and revoked from anon');

{
  // Depth and the draw must apply the SAME filter, or prewarm would top up
  // against a number the actual round composition disagrees with.
  const exclusionJoins = migration.match(/question_bank_reroll_exclusions x/g) ?? [];
  const itemJoins = migration.match(/question_items qi/g) ?? [];
  assert.equal(exclusionJoins.length, 2, 'both functions must exclude the reroll list');
  assert.equal(itemJoins.length, 2, 'both functions must exclude questions already served to this user');
}
ok('fetch_bank_candidates and bank_pool_depth apply the same two per-user exclusions');

console.log(`\n${passed} prewarm checks passed`);
