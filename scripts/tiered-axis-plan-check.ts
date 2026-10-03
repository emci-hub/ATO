/**
 * The adaptive round allocation (staged intake, emci 2026-10-02) — the ONE
 * rule that decides how many questions each trait gets in a round, for bank
 * and AI questions alike. File name kept from the tiered plan it replaced.
 * Run: npm run check:tiered-axis-plan
 *
 * Proves, with real tracks built by the real EWMA:
 *   - a round is always exactly 16 and never more than 3 per trait;
 *   - a settled, recent, consistent profile gets exactly 1 per trait (even);
 *   - unsettled traits are filled toward 3 first, mixed traits (answers that
 *     pulled two ways) and decaying traits (idle past 60 days) get 2, and the
 *     leftovers go to whoever waited longest;
 *   - the weakest reads are served first (map key order);
 *   - an old-50 account's ten short traits each get their third question;
 *   - the top-up for a short round respects the cap and skips empty traits.
 */
import assert from 'node:assert/strict';

import {
  allocateRound,
  MAX_PER_TRAIT_PER_ROUND,
  ONGOING_ROUND_SIZE,
  RECHECK_PER_ROUND,
  topUpAllocation,
  traitNeed,
} from '../src/lib/questions/tiered-axis-plan';
import { LEGACY_INTAKE_AXIS_COUNTS } from '../src/lib/questions/bank';
import { MIXED_TRAIT_LINE } from '../src/lib/questions/staged-intake-copy';
import {
  applyEwmaAnswer,
  DECAY_GRACE_DAYS,
  isAxisMixed,
  MIXED_STABILITY_BELOW,
  settlingLine,
  type TraitTrack,
} from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const NOW = new Date('2026-10-02T12:00:00Z');
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function answered(axis: TraitAxis, samples: readonly number[], at: string): TraitTrack {
  let row: TraitTrack | null = null;
  for (const sample of samples) row = applyEwmaAnswer(row, axis, 'report', sample, at);
  return row!;
}

function profile(build: (axis: TraitAxis, index: number) => TraitTrack | null): TraitTrack[] {
  return TRAIT_AXES.map((axis, index) => build(axis, index)).filter((row): row is TraitTrack => row != null);
}

function total(plan: Partial<Record<TraitAxis, number>>): number {
  return Object.values(plan).reduce((sum, n) => sum + (n ?? 0), 0);
}

function assertShape(plan: Partial<Record<TraitAxis, number>>, label: string) {
  assert.equal(total(plan), ONGOING_ROUND_SIZE, `${label}: round must be exactly ${ONGOING_ROUND_SIZE}`);
  for (const [axis, n] of Object.entries(plan)) {
    assert.ok((n ?? 0) <= MAX_PER_TRAIT_PER_ROUND, `${label}: ${axis} got ${n}, over the cap`);
    assert.ok((n ?? 0) > 0, `${label}: zero entries are left out of the map`);
  }
}

// --- constants ---------------------------------------------------------------
assert.equal(ONGOING_ROUND_SIZE, 16);
assert.equal(ONGOING_ROUND_SIZE, TRAIT_AXES.length, 'a round is one per trait when nothing needs more');
assert.equal(MAX_PER_TRAIT_PER_ROUND, 3);
assert.equal(RECHECK_PER_ROUND, 2);
ok('a round is 16 (one per trait), capped at 3 per trait, rechecks get 2');

// --- the EWMA facts the "mixed" flag stands on --------------------------------
{
  const consistent = answered('openness', [0.8, 0.8, 0.8], daysAgo(1));
  const mild = answered('openness', [0.8, 0.5, 0.8], daysAgo(1));
  const flipFlop = answered('openness', [0.8, 0.2, 0.8], daysAgo(1));
  const swing = answered('openness', [0.8, 0.2, 0.2], daysAgo(1));
  assert.ok(consistent.stability >= MIXED_STABILITY_BELOW && !isAxisMixed(consistent));
  assert.ok(mild.stability >= MIXED_STABILITY_BELOW && !isAxisMixed(mild), `mild ${mild.stability}`);
  assert.ok(flipFlop.stability > 0, 'a flip-flop still counts as settled (stability > 0)…');
  assert.ok(isAxisMixed(flipFlop), `…but reads as mixed (${flipFlop.stability})`);
  assert.ok(isAxisMixed(swing), `a swing that stays reads as mixed (${swing.stability})`);
  assert.equal(settlingLine(flipFlop, NOW), MIXED_TRAIT_LINE, 'a mixed trait says so honestly');
  assert.equal(settlingLine(consistent, NOW), null, 'a consistent settled trait says nothing');
  assert.match(settlingLine(answered('openness', [0.8], daysAgo(1)), NOW) ?? '', /1 of 3 answers/);
  ok('high/low/high is "settled" by the old rule but mixed by the new flag, and says so; consistent answers are not mixed');
}

// --- steady state: even ---------------------------------------------------------
{
  const tracks = profile((axis) => answered(axis, [0.6, 0.6, 0.6], daysAgo(3)));
  const plan = allocateRound(tracks, NOW);
  assertShape(plan, 'steady');
  for (const axis of TRAIT_AXES) assert.equal(plan[axis], 1, `steady: ${axis} gets 1`);
  for (const axis of TRAIT_AXES) assert.equal(traitNeed(tracks, axis, NOW).need, 'refresh');
  ok('a settled, recent, consistent profile gets exactly 1 per trait');
}

// --- fresh account: breadth first ----------------------------------------------
{
  const plan = allocateRound([], NOW);
  assertShape(plan, 'fresh');
  for (const axis of TRAIT_AXES) assert.equal(plan[axis], 1, `fresh: ${axis} gets 1 (breadth before depth)`);
  ok('nothing answered: every trait gets one before any gets a second');
}

// --- old-50 account: the ten short traits each get their third -------------------
{
  const tracks = profile((axis) =>
    answered(axis, Array(LEGACY_INTAKE_AXIS_COUNTS[axis]).fill(0.6), daysAgo(2)),
  );
  const plan = allocateRound(tracks, NOW);
  assertShape(plan, 'old 50');
  const short = TRAIT_AXES.filter((axis) => LEGACY_INTAKE_AXIS_COUNTS[axis] < 3);
  assert.equal(short.length, 10);
  for (const axis of short) assert.ok((plan[axis] ?? 0) >= 1, `old 50: ${axis} gets its third`);
  assert.deepEqual(Object.keys(plan).slice(0, 10).sort(), [...short].sort(), 'the short traits are served first');
  ok('an account that finished the old 50 gets one question on each of its ten short traits, first');
}

// --- mixed and decaying get 2, unsettled filled to 3 ------------------------------
{
  const tracks = profile((axis) => {
    if (axis === 'steadiness') return answered(axis, [0.6], daysAgo(1)); // unsettled, needs 2
    if (axis === 'autonomy') return answered(axis, [0.8, 0.2, 0.8], daysAgo(1)); // mixed
    if (axis === 'playfulness') return answered(axis, [0.6, 0.6, 0.6], daysAgo(DECAY_GRACE_DAYS + 30)); // decaying
    return answered(axis, [0.6, 0.6, 0.6], daysAgo(2));
  });
  assert.equal(traitNeed(tracks, 'steadiness', NOW).need, 'unsettled');
  assert.equal(traitNeed(tracks, 'autonomy', NOW).need, 'mixed');
  assert.equal(traitNeed(tracks, 'playfulness', NOW).need, 'decaying');
  const plan = allocateRound(tracks, NOW);
  assertShape(plan, 'needs');
  assert.equal(plan.steadiness, 2, 'unsettled at 1 answer gets the 2 it needs');
  assert.equal(plan.autonomy, RECHECK_PER_ROUND, 'mixed gets 2');
  assert.equal(plan.playfulness, RECHECK_PER_ROUND, 'decaying gets 2');
  assert.deepEqual(Object.keys(plan).slice(0, 3), ['steadiness', 'autonomy', 'playfulness'], 'weakest reads served first');
  // 16 - 6 = 10 leftovers over the other 13 traits: none gets more than 1.
  for (const axis of TRAIT_AXES) {
    if (['steadiness', 'autonomy', 'playfulness'].includes(axis)) continue;
    assert.ok((plan[axis] ?? 0) <= 1, `${axis} refresh stays at most 1`);
  }
  ok('unsettled filled toward 3, mixed and decaying get 2, served first; the rest are refreshed');
}

// --- leftovers go to the longest-waiting --------------------------------------------
{
  const tracks = profile((axis, index) => {
    if (axis === 'steadiness') return answered(axis, [0.8, 0.2, 0.8], daysAgo(1)); // mixed: 2
    return answered(axis, [0.6, 0.6, 0.6], daysAgo(1 + index)); // later axes waited longer
  });
  const plan = allocateRound(tracks, NOW);
  assertShape(plan, 'leftovers');
  assert.equal(plan.steadiness, 2);
  // 14 leftovers over 15 refresh traits: the one that waited least is skipped.
  const refresh = TRAIT_AXES.filter((axis) => axis !== 'steadiness');
  const skipped = refresh.filter((axis) => !plan[axis]);
  assert.deepEqual(skipped, [refresh[0]], 'the most recently answered trait is the one left out');
  ok('leftover slots go to the traits that waited longest');
}

// --- a deeply unsettled account is still capped and exactly 16 ---------------------------
{
  const tracks = profile((axis, index) => (index < 4 ? null : answered(axis, [0.6, 0.6, 0.6], daysAgo(1))));
  const plan = allocateRound(tracks, NOW);
  assertShape(plan, 'four empty');
  for (const axis of TRAIT_AXES.slice(0, 4)) assert.equal(plan[axis], 3, `${axis} filled to 3`);
  ok('four empty traits get 3 each (the cap), the rest share what is left');
}

// --- top-up for a short round --------------------------------------------------------------
{
  const tracks = profile((axis) => answered(axis, [0.6, 0.6, 0.6], daysAgo(2)));
  const have: Partial<Record<TraitAxis, number>> = { openness: 3, extraversion: 1 };
  const exhausted = new Set<TraitAxis>(['steadiness']);
  const top = topUpAllocation(have, 5, tracks, exhausted, NOW);
  assert.equal(total(top), 5);
  assert.equal(top.openness, undefined, 'a trait already at the cap gets nothing');
  assert.equal(top.steadiness, undefined, 'a trait the bank has run out of is skipped');
  assert.ok(Object.values(top).every((n) => (n ?? 0) <= MAX_PER_TRAIT_PER_ROUND));
  ok('a short round is topped up on other traits, under the cap, skipping empty ones');
}

console.log(`\n${passed} tiered-axis-plan (adaptive allocation) checks passed`);
