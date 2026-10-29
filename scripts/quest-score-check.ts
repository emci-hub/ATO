/**
 * Quests scoring + sims (ATO-BUILD PHASE-13).
 * Run: npm run check:quest-score
 *
 * Pins: the spec's worked example; misclick, flip-flop, chaotic, for-fun,
 * undone, contradiction, the limits (3 axes / |Δ| 0.08 / 7 days / 30 days) and
 * decay fixtures; then the sim harness: 1,000 random runs per registered
 * campaign (each target axis applied in ≤ 12% of random runs, mean random
 * |Δ| ≤ 0.02, emci 2026-10-28; skipped for isSample) and a consistent player
 * who must apply at least one axis. Two harness campaigns (built here, validated
 * clean) prove the walker against the exact random odds.
 */
import assert from 'node:assert/strict';

import { QUEST_CAMPAIGNS } from '../src/lib/quests/content';
import {
  SCORE,
  axisLeans,
  evidenceWeight,
  isContradiction,
  previewGameValue,
  sampleFromLean,
  scoreRun,
  type QuestPick,
  type ScoreInput,
} from '../src/lib/quests/score';
import { SAID_COPY } from '../src/lib/quests/strings';
import type { AxisTag, QuestCampaign, QuestChoice, QuestScene, Stat } from '../src/lib/quests/types';
import { validateCampaign } from '../src/lib/quests/validate';
import { effectiveStability, type TraitTrack } from '../src/lib/trait-stability';
import type { TraitAxis } from '../src/lib/traits';

const ok = (msg: string) => console.log(`  ok  ${msg}`);
const near = (a: number | undefined, b: number, eps = 1e-9, msg = '') => {
  assert.ok(a !== undefined && Math.abs(a - b) <= eps, `${msg} expected ${b}, got ${a}`);
};

const NOW = new Date('2026-10-28T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

// --- builders -----------------------------------------------------------------
const tag = (axis: TraitAxis, pole: 1 | -1, w: 1 | 0.4 = 1): AxisTag => ({ axis, pole, w });
const choice = (id: string, tags: AxisTag[]): QuestChoice => ({
  id,
  label: 'We go on.',
  approach: 'steady',
  result: [{ kind: 'narrator', text: 'The crew moves on.' }],
  tags,
});
/** A primary scene for `axis` with a +1 choice "p", a −1 choice "m" and an untagged choice "z". */
const primaryScene = (id: string, axis: TraitAxis, next: string | null = null, chapter: 1 | 2 | 3 | 4 = 1): QuestScene => ({
  id,
  chapter,
  primaryAxis: axis,
  lines: [{ kind: 'narrator', text: 'A choice.' }],
  choices: [choice('p', [tag(axis, 1)]), choice('m', [tag(axis, -1)]), choice('z', [])],
  next,
  art: { location: 'lantern.flooded-gate' },
});
const camp = (scenes: QuestScene[], extra: Partial<QuestCampaign> = {}): QuestCampaign => ({
  id: 'fixture',
  title: 'Fixture',
  setting: 'fantasy',
  minutes: 5,
  contentVersion: 1,
  sceneIdsFrozen: [],
  targetAxes: ['openness', 'autonomy', 'playfulness'],
  startStats: { supplies: 3, morale: 3, renown: 3 },
  firstScene: scenes[0]?.id ?? 'x',
  scenes,
  endings: [{ id: 'end', title: 'The end', when: {}, lines: [{ kind: 'narrator', text: 'Home.' }], art: 'lantern.ending-long-way-home' }],
  ...extra,
});
const track = (axis: TraitAxis, kind: 'report' | 'game', value: number, stability = 0, answerCount = 5, lastTouched = daysAgo(1)): TraitTrack => ({
  axis,
  track: kind,
  value,
  stability,
  answerCount,
  lastTouched,
  lastDepthAt: null,
});
/** Picks "p"/"m"/"z" in scenes `${prefix}1…`. */
const picksOf = (prefix: string, seq: string): QuestPick[] => [...seq].map((c, i) => ({ sceneId: `${prefix}${i + 1}`, choiceId: c }));
/** n primary scenes on one axis, ids `${prefix}1…n`. */
const axisScenes = (prefix: string, axis: TraitAxis, n: number) => Array.from({ length: n }, (_, i) => primaryScene(`${prefix}${i + 1}`, axis));
const run = (c: QuestCampaign, picks: QuestPick[], over: Partial<ScoreInput> = {}) =>
  scoreRun({ campaign: c, picks, mode: 'me', now: NOW, tracks: [], ...over });
const verdict = (r: ReturnType<typeof scoreRun>, axis: TraitAxis) => {
  const v = r.axes.find((x) => x.axis === axis);
  assert.ok(v, `no verdict for ${axis}`);
  return v;
};

// --- 1. worked example ----------------------------------------------------------
{
  const scenes = [...axisScenes('o', 'openness', 4), {
    ...primaryScene('x1', 'autonomy'),
    choices: [choice('p', [tag('autonomy', 1), tag('openness', 1, 0.4)]), choice('m', [tag('autonomy', -1)])],
  }];
  const c = camp(scenes);
  const picks = [...picksOf('o', 'ppmp'), { sceneId: 'x1', choiceId: 'p' }];
  const report = track('openness', 'report', 0.62, 0.5);
  near(effectiveStability(report, NOW), 0.5, 1e-12, 'report stability');
  const r = run(c, picks, { tracks: [report, track('openness', 'game', 0.6)] });
  const v = verdict(r, 'openness');
  near(v.P, 2.4, 1e-12, 'P');
  near(v.W, 4.4, 1e-12, 'W');
  near(v.lean, 2.4 / 4.4, 1e-12, 'L');
  near(v.consistency, 0.75, 1e-12, 'C');
  assert.equal(v.scenes, 4);
  assert.equal(v.eligible, true);
  near(v.s, 0.5 + 0.3 * (2.4 / 4.4), 1e-12, 's');
  near(v.s, 0.664, 0.0005, 's (spec .664)');
  near(v.g, 0.13125, 1e-12, 'g');
  near(v.g, 0.131, 0.0005, 'g (spec .131)');
  // Exact: 0.6 + 0.13125·(0.66364 − 0.6) = 0.60835; the spec's .609 is the same number rounded from rounded inputs.
  near(v.to, 0.609, 0.001, 'to (spec .609)');
  near(v.to, 0.6 + 0.13125 * (0.5 + 0.3 * (2.4 / 4.4) - 0.6), 1e-12, 'to exact');
  assert.equal(v.status, 'apply');
  assert.deepEqual(r.apply.map((x) => x.axis), ['openness']);
  ok(`worked example: L=${v.lean.toFixed(3)} C=${v.consistency} n=4 s=${v.s!.toFixed(4)} g=${v.g!.toFixed(5)} game .60 → ${v.to!.toFixed(4)}`);
}

// --- 2. formula pieces ----------------------------------------------------------
{
  near(sampleFromLean(1), 0.8);
  near(sampleFromLean(-1), 0.2);
  near(sampleFromLean(5), 0.8, 1e-12, 'lean clamps');
  near(evidenceWeight(1, 4, 0), 0.25);
  near(evidenceWeight(1, 9, 0), 0.25, 1e-12, 'n/4 caps at 1');
  near(evidenceWeight(1, 3, 0), 0.1875, 1e-12, 'n=3 → ×0.75');
  near(evidenceWeight(1, 4, 1), 0.1, 1e-12, 'stab 1 → ×0.4');
  for (let i = 0; i <= 20; i += 1) {
    const L = -1 + i / 10;
    const s = sampleFromLean(L);
    assert.ok(s >= 0.2 - 1e-12 && s <= 0.8 + 1e-12, `s out of range at L=${L}`);
  }
  // No game track: start at 0.5.
  near(previewGameValue(null, 0.8, 0.25), 0.575, 1e-12, 'null game starts at 0.5');
  ok('s stays in 0.2…0.8; g = 0.25·C·min(1,n/4)·(1−0.6·stab); a missing game track starts at 0.5');
}

// --- 3. misclick ----------------------------------------------------------------
{
  const c3 = camp(axisScenes('o', 'openness', 3));
  const r3 = run(c3, picksOf('o', 'ppm'));
  assert.equal(verdict(r3, 'openness').status, 'not_enough', '2 of 3 is C=.667 < .67');
  assert.deepEqual(r3.notEnough, ['openness']);
  const c4 = camp(axisScenes('o', 'openness', 4));
  const clean = verdict(run(c4, picksOf('o', 'pppp')), 'openness');
  const slip = verdict(run(c4, picksOf('o', 'pppm')), 'openness');
  assert.equal(slip.status, 'apply');
  assert.ok(slip.g! < clean.g! && slip.delta! < clean.delta!, 'one misclick weighs less than none');
  ok(`misclick: 2 of 3 = not enough; 3 of 4 still applies, g ${slip.g!.toFixed(4)} < ${clean.g!.toFixed(4)}`);
}

// --- 4. flip-flop and chaotic ---------------------------------------------------
{
  const c = camp(axisScenes('o', 'openness', 4));
  const v = verdict(run(c, picksOf('o', 'pmpm')), 'openness');
  assert.equal(v.lean, 0);
  assert.equal(v.status, 'not_enough');
  // Dodging with untagged picks is not consistency: 3 of 4 the same but one untagged → C=.75, and with 2 untagged → .5.
  near(verdict(run(c, picksOf('o', 'pppz')), 'openness').consistency, 0.75);
  assert.equal(verdict(run(c, picksOf('o', 'ppzz')), 'openness').status, 'not_enough');

  const chaos = camp([...axisScenes('o', 'openness', 4), ...axisScenes('a', 'autonomy', 4), ...axisScenes('y', 'playfulness', 4)]);
  const r = run(chaos, [...picksOf('o', 'pmzp'), ...picksOf('a', 'mzpm'), ...picksOf('y', 'zzpm')]);
  assert.deepEqual(r.apply, []);
  assert.deepEqual(r.notEnough, ['openness', 'autonomy', 'playfulness']);
  ok('flip-flop (L=0) and a chaotic run apply nothing; untagged picks lower C');
}

// --- 5. for-fun and undone ------------------------------------------------------
{
  const c = camp(axisScenes('o', 'openness', 4));
  const fun = run(c, picksOf('o', 'pppp'), { mode: 'fun' });
  assert.equal(fun.counts, false);
  assert.equal(fun.why, 'for_fun');
  assert.deepEqual(fun.apply, []);
  assert.equal(verdict(fun, 'openness').status, 'not_counted');

  // Undone picks never count: a rewound "m" replaced by "p" in the same scene.
  const rewound: QuestPick[] = [
    { sceneId: 'o1', choiceId: 'p' },
    { sceneId: 'o2', choiceId: 'm', undone: true },
    { sceneId: 'o2', choiceId: 'p' },
    { sceneId: 'o3', choiceId: 'p' },
  ];
  const v = verdict(run(c, rewound), 'openness');
  assert.equal(v.primaryPicks, 3);
  assert.equal(v.consistency, 1);
  assert.equal(v.status, 'apply');
  // Every pick undone = nothing touched.
  assert.deepEqual(run(c, picksOf('o', 'pppp').map((p) => ({ ...p, undone: true }))).axes, []);
  // Unknown scene/choice ids are ignored.
  assert.deepEqual(run(c, [{ sceneId: 'nope', choiceId: 'p' }, { sceneId: 'o1', choiceId: 'nope' }]).axes, []);
  ok('for-fun records nothing; undone and unknown picks are skipped');
}

// --- 6. contradiction guard -----------------------------------------------------
{
  const c = camp(axisScenes('o', 'openness', 4));
  const picks = picksOf('o', 'pppp'); // s = 0.8
  const status = (report: TraitTrack) => verdict(run(c, picks, { tracks: [report] }), 'openness').status;
  assert.equal(status(track('openness', 'report', 0.3, 0.4)), 'contradiction');
  assert.equal(status(track('openness', 'report', 0.3, 0.39)), 'apply', 'stab below 0.4 trusts the story');
  assert.equal(status(track('openness', 'report', 0.55, 0.9)), 'apply', 'same side');
  assert.equal(status(track('openness', 'report', 0.5, 0.9)), 'apply', 'report exactly neutral');
  assert.equal(status(track('openness', 'report', 0.51, 0.9)), 'apply');
  // s .8 vs report .49: opposite sides but only .31 apart → blocked; 4 primaries at 3 of 4 (s .65) vs .4 → .25 apart → applies.
  assert.equal(status(track('openness', 'report', 0.49, 0.9)), 'contradiction');
  assert.equal(verdict(run(c, picksOf('o', 'pppm'), { tracks: [track('openness', 'report', 0.4, 0.9)] }), 'openness').status, 'apply');
  assert.equal(isContradiction(0.2, { value: 0.8, stability: 0.5 }), true);
  assert.equal(isContradiction(0.2, null), false);
  assert.ok(SAID_COPY.contradiction.startsWith('Your story self went the other way.'));
  ok('contradiction: stab ≥ .4 and s across 0.5 by > .3 gets nothing; milder or unsettled reports apply');
}

// --- 7. limits ------------------------------------------------------------------
{
  // 3 axes per run, ranked by C·|L|.
  const four = camp([
    ...axisScenes('o', 'openness', 4),
    ...axisScenes('a', 'autonomy', 4),
    ...axisScenes('y', 'playfulness', 4),
    ...axisScenes('e', 'extraversion', 4),
  ]);
  const r = run(four, [...picksOf('o', 'pppm'), ...picksOf('a', 'pppp'), ...picksOf('y', 'mmmm'), ...picksOf('e', 'pppz')]);
  // C·|L|: autonomy 1·1, playfulness 1·1 (tie → n, then QUEST_AXES order), extraversion .75·1, openness .75·.5.
  assert.deepEqual(r.apply.map((v) => v.axis), ['autonomy', 'playfulness', 'extraversion']);
  assert.equal(verdict(r, 'openness').status, 'over_limit');
  assert.equal(new Set(r.apply.map((v) => v.axis)).size, r.apply.length, 'one write per axis');

  // |Δ| ≤ 0.08.
  const c = camp(axisScenes('o', 'openness', 4));
  const big = verdict(run(c, picksOf('o', 'pppp'), { tracks: [track('openness', 'game', 0.2)] }), 'openness');
  near(big.g, 0.25);
  near(big.to, 0.28, 1e-12, 'capped at +0.08 (uncapped 0.35)');
  near(previewGameValue(0.9, 0.2, 0.25), 0.82, 1e-12, 'capped at −0.08');
  near(previewGameValue(0.5, 0.6, 0.25), 0.525, 1e-12, 'small moves untouched');

  // 7 days per axis.
  const at = (iso: string) => verdict(run(c, picksOf('o', 'pppp'), { lastAppliedAt: { openness: iso } }), 'openness').status;
  assert.equal(at(daysAgo(6.99)), 'cooldown');
  assert.equal(at(daysAgo(7)), 'apply');
  assert.equal(at(daysAgo(-1)), 'cooldown', 'a future stamp (clock moved back) still blocks');
  assert.equal(at('not a date'), 'apply', 'mirror only: the server owns the real rule');

  // 30 days per campaign.
  const within = run(c, picksOf('o', 'pppp'), { priorEvidenceRuns: [daysAgo(29.9)] });
  assert.equal(within.counts, false);
  assert.equal(within.why, 'evidence_window');
  assert.deepEqual(within.apply, []);
  assert.equal(run(c, picksOf('o', 'pppp'), { priorEvidenceRuns: [daysAgo(30)] }).counts, true);
  assert.equal(run(c, picksOf('o', 'pppp'), { priorEvidenceRuns: [daysAgo(-2)] }).counts, false);
  ok('limits: top 3 by C·|L|, one write per axis, |Δ| ≤ 0.08, 7 days per axis, 30 days per campaign');
}

// --- 8. decay -------------------------------------------------------------------
{
  const c = camp(axisScenes('o', 'openness', 4));
  const picks = picksOf('o', 'pppp');
  const fresh = track('openness', 'report', 0.25, 0.6, 5, daysAgo(10));
  const old = track('openness', 'report', 0.25, 0.6, 5, daysAgo(60 + 90));
  near(effectiveStability(old, NOW), 0.3, 1e-9, 'one half-life after the 60-day grace');
  assert.equal(verdict(run(c, picks, { tracks: [fresh] }), 'openness').status, 'contradiction');
  const v = verdict(run(c, picks, { tracks: [old] }), 'openness');
  assert.equal(v.status, 'apply', 'decayed below 0.4: the guard lets go');
  near(v.g, 0.25 * (1 - 0.6 * 0.3), 1e-9, 'g uses decayed stability');
  // Fewer than 3 report answers = stability 0.
  near(verdict(run(c, picks, { tracks: [track('openness', 'report', 0.25, 0.9, 2)] }), 'openness').g, 0.25);
  ok('decay: report stability is read through effectiveStability (60-day grace, 90-day half-life, 3-answer floor)');
}

// --- 9. axes outside the Quest list are ignored -----------------------------------
{
  const c = camp([...axisScenes('o', 'openness', 4), {
    ...primaryScene('s1', 'openness'),
    choices: [choice('p', [tag('steadiness', 1)]), choice('m', [tag('openness', -1)])],
  }]);
  const axes = axisLeans(c, [...picksOf('o', 'ppp'), { sceneId: 's1', choiceId: 'p' }]).map((x) => x.axis);
  assert.deepEqual(axes, ['openness']);
  ok('only the 10 allowed Quest axes are scored');
}

// --- 10. sims -------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type Picker = (scene: QuestScene, rand: () => number) => QuestChoice;
const randomPicker: Picker = (scene, rand) => scene.choices[Math.floor(rand() * scene.choices.length)];
/** Always the strongest choice for `poles[scene.primaryAxis]`; random elsewhere. */
const consistentPicker = (poles: Partial<Record<TraitAxis, 1 | -1>>): Picker => (scene, rand) => {
  const want = scene.primaryAxis ? poles[scene.primaryAxis] : undefined;
  const best = want
    ? [...scene.choices]
        .filter((ch) => ch.tags.some((t) => t.axis === scene.primaryAxis && t.pole === want))
        .sort((a, b) => Math.max(...b.tags.map((t) => t.w)) - Math.max(...a.tags.map((t) => t.w)))[0]
    : undefined;
  return best ?? randomPicker(scene, rand);
};

/** One run through a campaign (flags, gates, retired redirects, d20 on party stats). */
function simulate(c: QuestCampaign, pick: Picker, rand: () => number): QuestPick[] {
  const byId = new Map(c.scenes.map((s) => [s.id, s]));
  const flags = new Set<string>();
  const stats: Record<Stat, number> = { ...c.startStats };
  const picks: QuestPick[] = [];
  let id: string | null = c.firstScene;
  for (let hops = 0; id && hops < 100; hops += 1) {
    let scene = byId.get(id);
    for (let r = 0; scene?.retired && scene.redirect && r < 5; r += 1) scene = byId.get(scene.redirect);
    if (!scene || scene.retired) break;
    const gate = scene.requires;
    if (gate && (!(gate.flags ?? []).every((f) => flags.has(f)) || (gate.notFlags ?? []).some((f) => flags.has(f)))) {
      id = scene.next;
      continue;
    }
    const ch = pick(scene, rand);
    picks.push({ sceneId: scene.id, choiceId: ch.id });
    ch.setFlags?.forEach((f) => flags.add(f));
    for (const [k, d] of Object.entries(ch.stats ?? {}) as [Stat, number][]) stats[k] = Math.max(0, Math.min(6, stats[k] + d));
    if (ch.check) {
      const roll = 1 + Math.floor(rand() * 20);
      id = roll + stats[ch.check.stat] >= ch.check.dc ? ch.check.success : ch.check.fail;
    } else {
      id = ch.next ?? scene.next;
    }
  }
  return picks;
}

const SIM_RUNS = 1000;
/**
 * Sim target (emci 2026-10-28, option A; the spec's "< 5% of random runs" can't be met by any
 * valid campaign): for every target axis, random runs apply it at most 12% of the time, and the
 * mean random |Δ| over all (run, target axis) pairs stays at or under 0.02.
 */
const SIM_TARGET = { maxAxisRate: 0.12, maxMeanDelta: 0.02 } as const;
function simulateCampaign(c: QuestCampaign, seed: number) {
  const rand = mulberry32(seed);
  let applied = 0;
  let deltaSum = 0;
  const perAxis = new Map<TraitAxis, number>(c.targetAxes.map((a) => [a, 0]));
  for (let i = 0; i < SIM_RUNS; i += 1) {
    const r = scoreRun({ campaign: c, picks: simulate(c, randomPicker, rand), mode: 'me', now: NOW, tracks: [] });
    if (r.apply.length > 0) applied += 1;
    for (const v of r.apply) {
      if (perAxis.has(v.axis)) perAxis.set(v.axis, perAxis.get(v.axis)! + 1);
      deltaSum += Math.abs(v.delta ?? 0);
    }
  }
  const poles = Object.fromEntries(c.targetAxes.map((a, i) => [a, i % 2 === 0 ? 1 : -1])) as Partial<Record<TraitAxis, 1 | -1>>;
  const steady = scoreRun({ campaign: c, picks: simulate(c, consistentPicker(poles), rand), mode: 'me', now: NOW, tracks: [] });
  return {
    rate: applied / SIM_RUNS,
    axisRate: Math.max(...[...perAxis.values()].map((n) => n / SIM_RUNS)),
    meanDelta: deltaSum / (SIM_RUNS * c.targetAxes.length),
    steadyApplied: steady.apply.length,
  };
}
const meetsTarget = (s: ReturnType<typeof simulateCampaign>) =>
  s.axisRate <= SIM_TARGET.maxAxisRate && s.meanDelta <= SIM_TARGET.maxMeanDelta;
const simLine = (id: string, s: ReturnType<typeof simulateCampaign>) =>
  `${id}: worst axis ${(s.axisRate * 100).toFixed(1)}% of random runs, mean |Δ| ${s.meanDelta.toFixed(4)}, any axis ${(s.rate * 100).toFixed(1)}%`;

// 10a. Registered campaigns.
for (const c of QUEST_CAMPAIGNS) {
  if (c.isSample) {
    ok(`sims: ${c.id} skipped (isSample)`);
    continue;
  }
  const s = simulateCampaign(c, 4242);
  assert.ok(meetsTarget(s), `sims: ${simLine(c.id, s)} (must be ≤ ${SIM_TARGET.maxAxisRate * 100}% per axis and ≤ ${SIM_TARGET.maxMeanDelta})`);
  assert.ok(s.steadyApplied >= 1, `${c.id}: a consistent run applied nothing`);
  ok(`sims: ${simLine(c.id, s)}; consistent run applies ${s.steadyApplied}`);
}

// 10b. Harness campaigns: a 12-scene path, 3 axes × 4 primaries over 4 chapters.
//      Proves the walker and scorer against the exact random odds for this shape.
function harness(neutral: boolean): QuestCampaign {
  const axes: TraitAxis[] = ['openness', 'autonomy', 'playfulness'];
  const scenes: QuestScene[] = [];
  for (let i = 0; i < 12; i += 1) {
    const axis = axes[i % 3];
    const id = `h${i + 1}`;
    const base = primaryScene(id, axis, i < 11 ? `h${i + 2}` : null, (Math.floor(i / 3) + 1) as 1 | 2 | 3 | 4);
    const choices = neutral
      ? [base.choices[0], base.choices[1], choice('z', []), choice('y', [])]
      : [base.choices[0], base.choices[1]];
    scenes.push({ ...base, choices: choices.map((ch) => ({ ...ch, label: ch.id === 'p' ? 'We go first.' : ch.id === 'm' ? 'We hang back.' : 'We wait a moment.' })) });
  }
  return camp(scenes, { id: neutral ? 'harness-4' : 'harness-2', targetAxes: axes, sceneIdsFrozen: ['h1'], endings: [
    { id: 'a', title: 'One', when: { minStat: { morale: 6 } }, lines: [{ kind: 'narrator', text: 'Home.' }], art: 'lantern.ending-long-way-home' },
    { id: 'b', title: 'Two', when: { minStat: { supplies: 6 } }, lines: [{ kind: 'narrator', text: 'Home.' }], art: 'lantern.ending-long-way-home' },
    { id: 'c', title: 'Three', when: {}, lines: [{ kind: 'narrator', text: 'Home.' }], art: 'lantern.ending-long-way-home' },
  ] });
}
/** P(an axis applies) for one axis with 4 primaries: 3+ of 4 picks on the same pole. */
const axisOdds = (choices: number) => {
  const p = 1 / choices;
  return 2 * (4 * p ** 3 * (1 - p) + p ** 4);
};
for (const neutral of [false, true]) {
  const c = harness(neutral);
  assert.deepEqual(validateCampaign(c).errors, [], `${c.id} must validate`);
  const s = simulateCampaign(c, 2027);
  const expected = 1 - (1 - axisOdds(neutral ? 4 : 2)) ** 3;
  assert.ok(Math.abs(s.rate - expected) < 0.04, `${c.id}: sim ${s.rate} vs exact ${expected.toFixed(3)}`);
  assert.ok(Math.abs(s.axisRate - axisOdds(neutral ? 4 : 2)) < 0.04, `${c.id}: worst axis ${s.axisRate} vs exact ${axisOdds(neutral ? 4 : 2).toFixed(3)}`);
  assert.equal(s.steadyApplied, 3, `${c.id}: a consistent player applies all 3 target axes`);
  // The target bites: 2-choice primaries (62.5% per axis) fail it, 1-per-pole + 2 neutral (10.2%) pass.
  assert.equal(meetsTarget(s), neutral, `${c.id}: ${neutral ? 'must meet' : 'must miss'} the sim target`);
  ok(`sims: ${simLine(c.id, s)} (exact any-axis ${(expected * 100).toFixed(1)}%); ${neutral ? 'meets' : 'misses'} the target as expected`);
}

console.log(`quest-score: all checks passed (SCORE.maxDelta ${SCORE.maxDelta}, ${SIM_RUNS} sims per campaign)`);
