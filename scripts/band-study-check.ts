/**
 * Band study — 2-band vs 3-band, answered by simulation. Run: npm run check:band-study
 *
 * Why this exists: the app has three different band systems (traitBand's
 * 0.33/0.67, legends64's straight 0.5 midpoint, CATEGORY_FALLBACK_BANDS'
 * 0.35/0.65) and no way to check any of them against real data — RLS blocks
 * cross-user reads, there is no aggregation RPC, and the app is pre-launch.
 * So the distribution is DERIVED instead: replay realistic answer sequences
 * through the real applyEwmaAnswer code and read off where trait_tracks.value
 * actually piles up.
 *
 * IMPORTANT — what this file may and may not assert. scripts/ota-gate.ts
 * auto-discovers every check:* key in package.json, so this check blocks
 * `npm run ota:publish`. It therefore asserts STRUCTURAL INVARIANTS only
 * (support bounds, monotonicity, reachability) and merely PRINTS the
 * distribution. Asserting a percentage would break the publish gate the next
 * time anyone edits QUESTIONS_BANK, which is exactly the wrong incentive.
 *
 * Signal values are read off QUESTIONS_BANK rather than hardcoded, so the
 * study tracks the real instrument if the bank is ever re-authored.
 */
import assert from 'node:assert/strict';

import { QUESTIONS_BANK } from '../src/lib/questions/bank';
import { AXIS_TIER_COUNTS, TIERED_ROUND_SIZE } from '../src/lib/questions/tiered-axis-plan';
import { archetypeCode, midpointHighLow } from '../src/lib/legends64/classify';
import {
  applyEwmaAnswer,
  effectiveStability,
  STABILITY_FLOOR_N,
  type TraitTrack,
} from '../src/lib/trait-stability';
import {
  SLIDER_STOPS,
  TRAIT_AXES,
  TRAIT_BAND_HIGH_CUT,
  TRAIT_BAND_LOW_CUT,
  traitBand,
  type TraitAxis,
} from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ok ${label}`);
}

const NOW = '2026-09-14T12:00:00.000Z';

/* ---------------------------------------------------------------- the instrument */

/**
 * Every distinct option-value set the bank actually contains. The bank is 2-
 * or 3-option only (parseQuestionDraft and the insert_question_pack RPC both
 * reject anything else), so this collapses to a small number of shapes.
 */
function bankOptionSets(): number[][] {
  const seen = new Map<string, number[]>();
  for (const draft of QUESTIONS_BANK) {
    const values = draft.options.map((o) => o.value).sort((a, b) => a - b);
    seen.set(values.join(','), values);
  }
  return [...seen.values()];
}

/** Per-axis option sets, so an axis is simulated with its own real questions. */
function bankOptionSetsByAxis(): Map<TraitAxis, number[][]> {
  const out = new Map<TraitAxis, number[][]>();
  for (const draft of QUESTIONS_BANK) {
    const values = draft.options.map((o) => o.value).sort((a, b) => a - b);
    const list = out.get(draft.axis as TraitAxis) ?? [];
    list.push(values);
    out.set(draft.axis as TraitAxis, list);
  }
  return out;
}

const OPTION_SETS = bankOptionSets();
const BY_AXIS = bankOptionSetsByAxis();
const ALL_SIGNALS = [...new Set(OPTION_SETS.flat())].sort((a, b) => a - b);
const SIGNAL_MIN = Math.min(...ALL_SIGNALS);
const SIGNAL_MAX = Math.max(...ALL_SIGNALS);

/* ---------------------------------------------------------------------- the RNG */

/** Seeded LCG (numerical recipes). Deterministic — the gate re-runs this. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ------------------------------------------------------------------ the replay */

/**
 * One respondent answering one axis n times. `latent` is their true position;
 * `consistency` is the chance they pick the option nearest it (otherwise they
 * pick uniformly — inattention, ambiguous stem, genuine ambivalence).
 */
function replayAxis(
  axis: TraitAxis,
  latent: number,
  n: number,
  consistency: number,
  rand: () => number,
): TraitTrack | null {
  const sets = BY_AXIS.get(axis) ?? OPTION_SETS;
  let track: TraitTrack | null = null;
  for (let i = 0; i < n; i += 1) {
    const options = sets[Math.floor(rand() * sets.length)];
    let signal: number;
    if (rand() < consistency) {
      signal = options.reduce((best, v) =>
        Math.abs(v - latent) < Math.abs(best - latent) ? v : best,
      );
    } else {
      signal = options[Math.floor(rand() * options.length)];
    }
    track = applyEwmaAnswer(track, axis, 'report', signal, NOW);
  }
  return track;
}

type Arm = {
  label: string;
  rounds: number;
  consistency: number;
  centreHeavy: boolean;
};

type ArmResult = {
  values: number[];
  settled: number;
  eligiblePerUser: number[];
  codes: Map<string, number>;
  min: number;
  max: number;
};

const N_USERS = 20_000;

function runArm(arm: Arm, seed: number): ArmResult {
  const rand = lcg(seed);
  const values: number[] = [];
  const eligiblePerUser: number[] = [];
  const codes = new Map<string, number>();
  let settled = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let u = 0; u < N_USERS; u += 1) {
    const perUser: Partial<Record<TraitAxis, number | null>> = {};
    let eligible = 0;
    for (const axis of TRAIT_AXES) {
      // Centre-heavy prior = mean of two uniforms (a cheap Beta(2,2)), so the
      // conclusion is not an artifact of assuming true traits are uniform.
      const latent = arm.centreHeavy ? (rand() + rand()) / 2 : rand();
      const n = AXIS_TIER_COUNTS[axis] * arm.rounds;
      const track = replayAxis(axis, latent, n, arm.consistency, rand);
      if (!track) continue;
      values.push(track.value);
      if (track.value < min) min = track.value;
      if (track.value > max) max = track.value;
      if (effectiveStability(track) > 0) settled += 1;
      if (traitBand(track.value) !== 'mid') eligible += 1;
      perUser[axis] = track.value;
    }
    eligiblePerUser.push(eligible);
    const code = archetypeCode(perUser);
    codes.set(code, (codes.get(code) ?? 0) + 1);
  }
  return { values, settled, eligiblePerUser, codes, min, max };
}

/* --------------------------------------------------------------------- reporting */

function pct(part: number, whole: number): string {
  return whole === 0 ? 'n/a' : `${((part / whole) * 100).toFixed(1)}%`;
}

function bandSplit(values: number[], lo: number, hi: number) {
  let low = 0;
  let mid = 0;
  let high = 0;
  for (const v of values) {
    if (v <= lo) low += 1;
    else if (v >= hi) high += 1;
    else mid += 1;
  }
  return { low, mid, high };
}

function shoulderMass(values: number[], lo: number, hi: number, width: number): number {
  return values.filter((v) => (v > lo && v < lo + width) || (v > hi - width && v < hi)).length;
}

function histogram(values: number[], bins = 20): number[] {
  const out = new Array<number>(bins).fill(0);
  for (const v of values) {
    const i = Math.min(bins - 1, Math.floor(v * bins));
    out[i] += 1;
  }
  return out;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/* =================================================================== the study */

console.log('\nBAND STUDY — derived distribution of trait_tracks.value\n');
console.log(
  `  instrument:  ${QUESTIONS_BANK.length} bank questions, ${OPTION_SETS.length} distinct option sets`,
);
console.log(`  option sets: ${OPTION_SETS.map((s) => `[${s.join('/')}]`).join(' ')}`);
console.log(`  signals:     ${ALL_SIGNALS.join(', ')}`);
console.log(`  slider only: ${SLIDER_STOPS.join(', ')}  (5 of 16 axes)`);
console.log(`  round size:  ${TIERED_ROUND_SIZE} questions across ${TRAIT_AXES.length} axes`);
console.log(`  N = ${N_USERS.toLocaleString()} simulated respondents per arm\n`);

const ARMS: Arm[] = [
  { label: 'R1  25 answers  c=0.85  uniform', rounds: 1, consistency: 0.85, centreHeavy: false },
  { label: 'R2  50 answers  c=0.85  uniform', rounds: 2, consistency: 0.85, centreHeavy: false },
  { label: 'R4 100 answers  c=0.85  uniform', rounds: 4, consistency: 0.85, centreHeavy: false },
  { label: 'R2  50 answers  c=1.00  uniform', rounds: 2, consistency: 1.0, centreHeavy: false },
  { label: 'R2  50 answers  c=0.70  uniform', rounds: 2, consistency: 0.7, centreHeavy: false },
  { label: 'R2  50 answers  c=0.55  uniform', rounds: 2, consistency: 0.55, centreHeavy: false },
  { label: 'R2  50 answers  NULL    uniform', rounds: 2, consistency: 0.0, centreHeavy: false },
  { label: 'R2  50 answers  c=0.85  centre ', rounds: 2, consistency: 0.85, centreHeavy: true },
];

const results = new Map<string, ArmResult>();
ARMS.forEach((arm, i) => {
  results.set(arm.label, runArm(arm, 0x5eed + i * 7919));
});

const CUTS: Array<[number, number, string]> = [
  [TRAIT_BAND_LOW_CUT, TRAIT_BAND_HIGH_CUT, 'traitBand (live)'],
  [0.33, 0.67, 'old raw-0-1 cuts'],
  [0.4, 0.6, 'wider poles'],
];

console.log('  BAND SPLIT  low / mid / high\n');
console.log(`  ${'arm'.padEnd(34)}${CUTS.map(([lo, hi]) => `${lo} / ${hi}`.padEnd(26)).join('')}`);
for (const arm of ARMS) {
  const r = results.get(arm.label)!;
  const cols = CUTS.map(([lo, hi]) => {
    const s = bandSplit(r.values, lo, hi);
    const n = r.values.length;
    return `${pct(s.low, n)}  ${pct(s.mid, n)}  ${pct(s.high, n)}`.padEnd(26);
  });
  console.log(`  ${arm.label.padEnd(34)}${cols.join('')}`);
}

console.log('\n  POINT MASS AT 0.50, SHOULDERS, SUPPORT, ELIGIBLE AXES\n');
console.log(
  `  ${'arm'.padEnd(34)}${'@0.50'.padEnd(9)}${'shoulder'.padEnd(11)}${'support'.padEnd(16)}${'elig/16'.padEnd(10)}settled`,
);
for (const arm of ARMS) {
  const r = results.get(arm.label)!;
  const n = r.values.length;
  const exact = r.values.filter((v) => v === 0.5).length;
  const shoulder = shoulderMass(r.values, TRAIT_BAND_LOW_CUT, TRAIT_BAND_HIGH_CUT, 0.07);
  const support = `[${r.min.toFixed(2)}, ${r.max.toFixed(2)}]`;
  const elig = median(r.eligiblePerUser);
  console.log(
    `  ${arm.label.padEnd(34)}${pct(exact, n).padEnd(9)}${pct(shoulder, n).padEnd(11)}${support.padEnd(16)}${String(elig).padEnd(10)}${pct(r.settled, n)}`,
  );
}

const headline = results.get(ARMS[1].label)!;
console.log(`\n  HISTOGRAM — ${ARMS[1].label.trim()}, 20 bins of 0.05\n`);
const hist = histogram(headline.values);
const peak = Math.max(...hist);
hist.forEach((count, i) => {
  const lo = (i / 20).toFixed(2);
  const bar = '#'.repeat(Math.round((count / peak) * 46));
  console.log(`  ${lo}  ${bar} ${pct(count, headline.values.length)}`);
});

console.log('\n  64-ARCHETYPE SPREAD (midpointHighLow)\n');
const codeCounts = [...headline.codes.values()].sort((a, b) => b - a);
console.log(`    codes hit:  ${headline.codes.size} of 64`);
console.log(
  `    largest:    ${pct(codeCounts[0], N_USERS)}    smallest: ${pct(codeCounts[codeCounts.length - 1], N_USERS)}`,
);
console.log(`    even would be ${pct(N_USERS / 64, N_USERS)}`);

/**
 * The number that decides whether midpointHighLow's exactly-0.50 tie matters.
 * Legends unlocks at 50 answers (LEGENDS_UNLOCK_THRESHOLD), and its six axes
 * are the best-sampled ones — tier 1/2 get 6 answers by then, tier 3 get 4 —
 * so their 0.50 mass is lower than the global figure. Measured here rather
 * than assumed, because the global number does NOT decay to zero.
 */
console.log('\n  EXACTLY-0.50 ON THE SIX LEGENDS AXES, AT THE 50-ANSWER UNLOCK\n');
const LEGEND_AXES: TraitAxis[] = [
  'conscientiousness',
  'extraversion',
  'openness',
  'agreeableness',
  'conflict_assertiveness',
  'relatedness',
];
{
  const rand = lcg(0xfeed);
  let tied = 0;
  let total = 0;
  let anyTie = 0;
  for (let u = 0; u < N_USERS; u += 1) {
    let userTied = false;
    for (const axis of LEGEND_AXES) {
      const track = replayAxis(axis, rand(), AXIS_TIER_COUNTS[axis] * 2, 0.85, rand);
      total += 1;
      if (track && track.value === 0.5) {
        tied += 1;
        userTied = true;
      }
    }
    if (userTied) anyTie += 1;
  }
  console.log(`    per-axis tied at 0.50:        ${pct(tied, total)}`);
  console.log(`    users with >= 1 tied axis:    ${pct(anyTie, N_USERS)}`);
  console.log(`    (each tie is silently read as 'H' by midpointHighLow)`);
}

/* ============================================================ the assertions */

console.log('\n  STRUCTURAL INVARIANTS\n');

// (a) Convex update: the stored value can never leave the hull of its signals.
//     This is the headline — traitBand carves a 0-1 line the instrument cannot
//     reach the ends of.
for (const arm of ARMS) {
  const r = results.get(arm.label)!;
  assert.ok(r.min >= SIGNAL_MIN - 1e-9, `${arm.label}: min ${r.min} below signal floor ${SIGNAL_MIN}`);
  assert.ok(r.max <= SIGNAL_MAX + 1e-9, `${arm.label}: max ${r.max} above signal ceiling ${SIGNAL_MAX}`);
}
ok(`value never leaves the convex hull of its signals — support is [${SIGNAL_MIN}, ${SIGNAL_MAX}], not [0, 1]`);

// (b) The first answer lands verbatim. This is why most axes read as their
//     first answer: 10 of 16 get exactly one question per round.
for (const signal of ALL_SIGNALS) {
  const first = applyEwmaAnswer(null, 'openness', 'report', signal, NOW);
  assert.equal(first.value, signal);
  assert.equal(first.stability, 0);
  assert.equal(first.answerCount, 1);
}
ok('one answer of x yields value === x exactly, stability 0');

// (c) Kalman gain is monotonically non-increasing in stability — a settled
//     axis moves less than a fresh one. Probed through the public function.
let prevMove = Infinity;
for (let stability = 0; stability <= 1.0001; stability += 0.1) {
  const probe: TraitTrack = {
    axis: 'openness',
    track: 'report',
    value: 0.5,
    stability: Math.min(1, stability),
    answerCount: 5,
    lastTouched: NOW,
    lastDepthAt: null,
  };
  const move = Math.abs(applyEwmaAnswer(probe, 'openness', 'report', 1, NOW).value - 0.5);
  assert.ok(move <= prevMove + 1e-12, `gain rose at stability ${stability}`);
  prevMove = move;
}
ok('Kalman gain is monotonically non-increasing in stability');

// (d) Every candidate band cut lies strictly inside the reachable support, so
//     no band is unreachable. This is the assertion that fires loudly if
//     anyone ever narrows the bank's option values.
for (const [lo, hi, name] of CUTS) {
  assert.ok(lo > SIGNAL_MIN, `${name}: low cut ${lo} is at or below the signal floor — 'low' unreachable`);
  assert.ok(hi < SIGNAL_MAX, `${name}: high cut ${hi} is at or above the signal ceiling — 'high' unreachable`);
}
ok('every candidate band cut is inside the reachable support (no band is unreachable)');

// (e) All three bands are genuinely populated — the direct evidence for 3-band
//     over 2-band.
for (const arm of ARMS) {
  const r = results.get(arm.label)!;
  const s = bandSplit(r.values, TRAIT_BAND_LOW_CUT, TRAIT_BAND_HIGH_CUT);
  assert.ok(s.mid > 0, `${arm.label}: mid band empty`);
  assert.ok(s.low > 0 && s.high > 0, `${arm.label}: a pole band is empty`);
}
ok('all three bands are populated under every arm');

// (f) The silencing cost is survivable: the median user keeps enough non-mid
//     axes for pickSageKnowsAxis (>=1) and composeLocalExplore's 2-trait
//     branch (>=2). If this ever fails, mid needs narrowing or real copy.
for (const arm of ARMS.filter((a) => a.consistency > 0)) {
  const r = results.get(arm.label)!;
  assert.ok(
    median(r.eligiblePerUser) >= 2,
    `${arm.label}: median user has ${median(r.eligiblePerUser)} non-mid axes — Sage would go quiet`,
  );
}
ok('median user retains at least 2 non-mid axes in every non-null arm');

// (g) midpointHighLow is total and assigns the 0.50 point mass to H.
assert.equal(midpointHighLow(0.5), 'H');
assert.equal(midpointHighLow(null), 'L');
assert.equal(midpointHighLow(undefined), 'L');
assert.equal(midpointHighLow(Number.NaN), 'L');
ok('midpointHighLow is total; exactly-0.50 resolves to H, unset to L');

// (h) STABILITY_FLOOR_N is what makes a one-question-per-round axis unsettled.
assert.equal(STABILITY_FLOOR_N, 3);
const twoAnswers = replayAxis('playfulness', 0.8, 2, 1, lcg(1));
assert.equal(effectiveStability(twoAnswers), 0);
ok(`an axis under ${STABILITY_FLOOR_N} answers reads effectiveStability 0 regardless of value`);

console.log(`\n  band study: ${passed} invariants passed\n`);
