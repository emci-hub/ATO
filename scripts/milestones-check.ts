/**
 * MILESTONE_DEFS / checkMilestones, plus source assertions that
 * intake-sweep.tsx's backfill (T-04) and post-answer check (T-05) wire
 * through the shared checkMilestones/persistCelebratedMilestones — no
 * duplicated inline threshold logic, and the backfill pass never fires the
 * onMilestoneCrossed placeholder. Run: npm run check:milestones
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Check } from '../src/lib/checks';
import { computeStreak } from '../src/lib/growth';
import { addDaysYmd, localYmd } from '../src/lib/local-date';
import { axisVariant, bankQuestionCount } from '../src/lib/questions/local';
import { MILESTONE_DEFS, checkMilestones } from '../src/lib/milestones';
import { isProfileSettled, type TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';

function checkOn(ymd: string): Check {
  return {
    id: ymd,
    user_id: 'u',
    day: 0,
    logged_on: ymd,
    read_text: null,
    do_text: null,
    nudge_text: null,
    source: 'bank',
    status: 'done',
    created_at: `${ymd}T12:00:00.000Z`,
  };
}

/** A trait-track fixture for one axis at a given answerCount (report by default). */
function reportTrackAt(
  axis: (typeof TRAIT_AXES)[number],
  answerCount: number,
  track: TraitTrack['track'] = 'report',
): TraitTrack {
  return {
    axis,
    track,
    value: 0.5,
    stability: 0.5,
    answerCount,
    lastTouched: new Date().toISOString(),
    lastDepthAt: null,
  };
}

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const bankTotalDefs = MILESTONE_DEFS.filter((d) => d.metric === 'bankTotalProgress');
assert.equal(bankTotalDefs.length, 4);
assert.deepEqual(
  bankTotalDefs.map((d) => d.threshold),
  [12, 24, 36, 48],
);
assert.equal(new Set(MILESTONE_DEFS.map((d) => d.id)).size, MILESTONE_DEFS.length);
ok('MILESTONE_DEFS has 4 unique bankTotalProgress entries at 12/24/36/48');

// profile_50 is the only profile_percent def — profile_100 was removed:
// it was on bank_percent (answered/total bank questions x100), which
// always crossed in the same pass as answers_48 (bankTotalProgress), since
// both reduce to "every bank question answered" — redundant, so
// profile_100 and the bank_percent metric were dropped entirely.
const profilePercentDefs = MILESTONE_DEFS.filter((d) => d.metric === 'profile_percent');
assert.equal(profilePercentDefs.length, 1);
assert.deepEqual(
  profilePercentDefs.map((d) => d.id),
  ['profile_50'],
);
assert.equal(profilePercentDefs[0]!.threshold, 50);
assert.ok(
  !containsFrameworkTerm(profilePercentDefs[0]!.title) && !containsFrameworkTerm(profilePercentDefs[0]!.body),
  'profile_percent copy hits the framework fence',
);
ok('MILESTONE_DEFS has only profile_50 on profile_percent at threshold 50, fence-clean');

assert.deepEqual(checkMilestones('profile_percent', 49.9, []), []);
assert.deepEqual(
  checkMilestones('profile_percent', 50, []).map((d) => d.id),
  ['profile_50'],
);
ok('checkMilestones works unchanged for the profile_percent metric (no new mechanic needed)');

// streak_3/7/21 replace the old, removed one-time presence-milestone
// celebration (PRESENCE_MILESTONES = [7, 21] in growth.ts) with a real
// consecutive-day streak metric (current_streak, from computeStreak).
const streakDefs = MILESTONE_DEFS.filter((d) => d.metric === 'current_streak');
assert.equal(streakDefs.length, 3);
assert.deepEqual(
  streakDefs.map((d) => d.id),
  ['streak_3', 'streak_7', 'streak_21'],
);
assert.deepEqual(
  streakDefs.map((d) => d.threshold),
  [3, 7, 21],
);
assert.ok(
  streakDefs.every((d) => !containsFrameworkTerm(d.title) && !containsFrameworkTerm(d.body)),
  'current_streak copy hits the framework fence',
);
ok('MILESTONE_DEFS has streak_3/7/21 on current_streak at thresholds 3/7/21, fence-clean');

assert.deepEqual(checkMilestones('current_streak', 2, []), []);
assert.deepEqual(
  checkMilestones('current_streak', 7, []).map((d) => d.id),
  ['streak_3', 'streak_7'],
);
assert.deepEqual(
  checkMilestones('current_streak', 7, ['streak_3']).map((d) => d.id),
  ['streak_7'],
);
ok('checkMilestones works unchanged for the current_streak metric (no new mechanic needed)');

assert.ok(
  !MILESTONE_DEFS.some((d) => d.id === 'profile_100'),
  'profile_100 must be fully removed, not just re-metric\'d',
);
ok('profile_100 is gone from MILESTONE_DEFS');

// legends_unlocked: one-time "Legends unlocked!" celebration on
// isProfileSettled going false -> true, wired into legends.tsx (NOT
// intake-sweep.tsx) — this is the one milestone in this feature that
// doesn't run through crossedMilestonesFor.
const profileSettledDefs = MILESTONE_DEFS.filter((d) => d.metric === 'profile_settled');
assert.equal(profileSettledDefs.length, 1);
assert.deepEqual(
  profileSettledDefs.map((d) => d.id),
  ['legends_unlocked'],
);
assert.equal(profileSettledDefs[0]!.threshold, 1);
assert.ok(
  !containsFrameworkTerm(profileSettledDefs[0]!.title) && !containsFrameworkTerm(profileSettledDefs[0]!.body),
  'profile_settled copy hits the framework fence',
);
ok('MILESTONE_DEFS has legends_unlocked on profile_settled at threshold 1, fence-clean');

assert.deepEqual(checkMilestones('profile_settled', 0, []), []);
assert.deepEqual(
  checkMilestones('profile_settled', 1, []).map((d) => d.id),
  ['legends_unlocked'],
);
assert.deepEqual(checkMilestones('profile_settled', 1, ['legends_unlocked']), []);
ok('checkMilestones works unchanged for the profile_settled metric (no new mechanic needed)');

// Wiring proof: a real settled-profile TraitTrack fixture (all 16 axes,
// answerCount >= STABILITY_FLOOR_N) run through the actual isProfileSettled
// — the same predicate legends.tsx's `locked` already uses — must produce
// a crossed legends_unlocked def, not just checkMilestones fed a 1.
{
  const settledTracks = TRAIT_AXES.map((axis) => reportTrackAt(axis, 3));
  assert.equal(isProfileSettled(settledTracks), true, 'fixture must actually be settled, or this test proves nothing');
  assert.deepEqual(
    checkMilestones('profile_settled', isProfileSettled(settledTracks) ? 1 : 0, []).map((d) => d.id),
    ['legends_unlocked'],
    'a genuinely settled profile via isProfileSettled must cross legends_unlocked',
  );
  const oneAxisMissing = settledTracks.slice(1);
  assert.equal(isProfileSettled(oneAxisMissing), false, 'missing one axis must not read as settled');
  assert.deepEqual(
    checkMilestones('profile_settled', isProfileSettled(oneAxisMissing) ? 1 : 0, []),
    [],
    'an unsettled profile (missing one axis) must not cross legends_unlocked',
  );
}
ok('a real isProfileSettled(tracks) fixture actually crosses legends_unlocked');

const axisCompleteDefs = MILESTONE_DEFS.filter((d) => d.metric.startsWith('axisComplete:'));
assert.equal(axisCompleteDefs.length, TRAIT_AXES.length);
assert.deepEqual(
  new Set(axisCompleteDefs.map((d) => d.metric)),
  new Set(TRAIT_AXES.map((axis) => `axisComplete:${axis}`)),
);
for (const axis of TRAIT_AXES) {
  const def = axisCompleteDefs.find((d) => d.metric === `axisComplete:${axis}`);
  assert.ok(def, `no per-axis milestone def for ${axis}`);
  assert.equal(def!.id, `axis_complete_${axis}`);
  assert.equal(def!.threshold, bankQuestionCount([axis]));
  assert.ok(
    def!.threshold > 0,
    `axis ${axis} has a 0-question bank, so its milestone would be unconditionally already-crossed`,
  );
  assert.ok(def!.title.length > 0 && def!.body.length > 0);
  assert.ok(
    !containsFrameworkTerm(def!.title) && !containsFrameworkTerm(def!.body),
    `axis-complete copy for ${axis} hits the framework fence: "${def!.title}" / "${def!.body}"`,
  );
}
ok(`MILESTONE_DEFS has one axisComplete entry per axis (${TRAIT_AXES.length}), threshold = that axis's bank size, fence-clean`);

const firstAxis = TRAIT_AXES[0];
assert.deepEqual(
  checkMilestones(`axisComplete:${firstAxis}`, bankQuestionCount([firstAxis]), []).map((d) => d.id),
  [`axis_complete_${firstAxis}`],
);
assert.deepEqual(checkMilestones(`axisComplete:${firstAxis}`, bankQuestionCount([firstAxis]) - 1, []), []);
ok('checkMilestones works unchanged for a per-axis metric (no new mechanic needed)');

// Wiring proof: a real TraitTrack fixture run through axisVariant (the same
// function crossedMilestonesFor now calls), not just checkMilestones fed a
// hand-picked number — this is what "completing an axis" actually looks
// like on the wire, and it must produce a crossed def, not just prove the
// config entries exist.
for (const axis of [TRAIT_AXES[0], TRAIT_AXES[TRAIT_AXES.length - 1]]) {
  const full = bankQuestionCount([axis]);
  const completedTracks = [reportTrackAt(axis, full)];
  const stillGoingTracks = [reportTrackAt(axis, full - 1)];
  assert.deepEqual(
    checkMilestones(`axisComplete:${axis}`, axisVariant(completedTracks, axis), []).map((d) => d.id),
    [`axis_complete_${axis}`],
    `completing ${axis}'s bank via a real TraitTrack fixture must cross axis_complete_${axis}`,
  );
  assert.deepEqual(
    checkMilestones(`axisComplete:${axis}`, axisVariant(stillGoingTracks, axis), []),
    [],
    `one answer short of ${axis}'s bank must not cross axis_complete_${axis}`,
  );
  assert.deepEqual(
    checkMilestones(`axisComplete:${axis}`, axisVariant(completedTracks, axis), [`axis_complete_${axis}`]),
    [],
    `axis_complete_${axis} must not re-cross once already celebrated`,
  );

  // Gut-call (game track) never counts toward settled elsewhere in this
  // codebase, and axisVariant enforces that by reading the report track
  // only — a full game-track fixture must not cross the milestone either.
  const gameTracks = [reportTrackAt(axis, full, 'game')];
  assert.equal(axisVariant(gameTracks, axis), 0, `axisVariant must ignore a game-track-only fixture for ${axis}`);
  assert.deepEqual(
    checkMilestones(`axisComplete:${axis}`, axisVariant(gameTracks, axis), []),
    [],
    `a full gut-call (game track) fixture must not cross axis_complete_${axis}`,
  );
}
ok('completing an axis via a real TraitTrack/axisVariant fixture actually crosses its axis_complete_* milestone, and gut-call never counts');

// Wiring proof: a real Check[] fixture run through computeStreak (the same
// function crossedMilestonesFor now calls) must produce a crossed
// current_streak def — not just checkMilestones fed a hand-picked number.
{
  const TZ = 'America/Denver';
  const now = new Date('2026-09-06T15:00:00.000Z');
  const today = localYmd(now, TZ);
  const days = [0, -1, -2].map((offset) => checkOn(addDaysYmd(today, offset)));
  assert.deepEqual(
    checkMilestones('current_streak', computeStreak(days, TZ, now), []).map((d) => d.id),
    ['streak_3'],
    '3 consecutive real Check rows via computeStreak must cross streak_3',
  );
  assert.deepEqual(
    checkMilestones('current_streak', computeStreak(days.slice(1), TZ, now), []),
    [],
    'only 2 consecutive days (missing today, past grace) must not cross streak_3',
  );
  assert.deepEqual(
    checkMilestones('current_streak', computeStreak(days, TZ, now), ['streak_3']),
    [],
    'streak_3 must not re-cross once already celebrated',
  );
}
ok('a real streak via a Check[]/computeStreak fixture actually crosses streak_3');

assert.deepEqual(checkMilestones('bankTotalProgress', 0, []), []);
ok('below every threshold crosses nothing');

assert.deepEqual(
  checkMilestones('bankTotalProgress', 24, []).map((d) => d.id),
  ['answers_12', 'answers_24'],
);
ok('crossing 24 with nothing celebrated returns 12 and 24');

assert.deepEqual(
  checkMilestones('bankTotalProgress', 24, ['answers_12']).map((d) => d.id),
  ['answers_24'],
);
ok('already-celebrated ids are excluded');

assert.deepEqual(
  checkMilestones('bankTotalProgress', 48, ['answers_12', 'answers_24', 'answers_36', 'answers_48']),
  [],
);
ok('fully celebrated returns nothing even at max value');

const celebratedIds = ['answers_12'];
checkMilestones('bankTotalProgress', 48, celebratedIds);
assert.deepEqual(celebratedIds, ['answers_12']);
ok('checkMilestones does not mutate celebratedIds');

// Backfill scenario (T-04): an existing user who already answered 30 bank
// questions before this feature shipped should silently catch up on 12/24,
// with 36/48 still ahead of them.
assert.deepEqual(
  checkMilestones('bankTotalProgress', 30, []).map((d) => d.id),
  ['answers_12', 'answers_24'],
);
ok('backfill scenario: 30 answered, nothing celebrated yet, catches up to 12 and 24');

// --- Source assertions: intake-sweep.tsx wiring (T-04/T-05) ---
const intakeSweepSrc = readFileSync(
  resolve(__dirname, '../src/app/(tabs)/intake-sweep.tsx'),
  'utf8',
);

assert.ok(
  intakeSweepSrc.includes("import { checkMilestones, type MilestoneDef } from '@/lib/milestones';"),
  'intake-sweep.tsx imports checkMilestones from the shared module, not a duplicated version',
);
assert.ok(
  intakeSweepSrc.includes("import { persistCelebratedMilestones } from '@/lib/me';"),
  'intake-sweep.tsx imports persistCelebratedMilestones from the shared module',
);
assert.ok(
  intakeSweepSrc.includes("import { computeStreak } from '@/lib/growth';"),
  'intake-sweep.tsx imports computeStreak from the shared module',
);
assert.equal(
  (intakeSweepSrc.match(/checkMilestones\(/g) ?? []).length,
  4,
  'checkMilestones should be called exactly 4 times, file-wide, once per metric group ' +
    '(bankTotalProgress, profile_percent, current_streak, and once inside the per-axis flatMap)',
);
assert.equal(
  (intakeSweepSrc.match(/crossedMilestonesFor\(/g) ?? []).length,
  3,
  'crossedMilestonesFor should be defined once and called from both the backfill effect and ' +
    'refreshAfterAnswer (3 occurrences total: 1 definition + 2 call sites)',
);

const crossedMilestonesForStart = intakeSweepSrc.indexOf('function crossedMilestonesFor(');
const crossedMilestonesForEnd = intakeSweepSrc.indexOf('export default function IntakeSweepTabScreen');
assert.ok(
  crossedMilestonesForStart > -1 && crossedMilestonesForEnd > crossedMilestonesForStart,
  'expected anchors around crossedMilestonesFor were not found in intake-sweep.tsx — did it move or get renamed?',
);
const crossedMilestonesForBody = intakeSweepSrc.slice(crossedMilestonesForStart, crossedMilestonesForEnd);
assert.equal(
  (crossedMilestonesForBody.match(/checkMilestones\(/g) ?? []).length,
  4,
  'all 4 checkMilestones call sites (bankTotalProgress, profile_percent, current_streak, per-axis ' +
    'flatMap) must live inside crossedMilestonesFor, not duplicated at each caller',
);
assert.ok(
  /computeStreak\(\s*checks,\s*timezone\s*\)/.test(crossedMilestonesForBody),
  'current_streak must be computed via computeStreak(checks, timezone), not a duplicated formula',
);
assert.ok(
  crossedMilestonesForBody.includes("checkMilestones('current_streak'"),
  'current_streak must be checked in crossedMilestonesFor alongside the other metrics',
);
assert.ok(
  /settledCount\(\s*tracks\s*\)\s*\/\s*TRAIT_AXES\.length/.test(crossedMilestonesForBody),
  'profile_percent must be computed as the settled-axis ratio via settledCount, at the same call ' +
    'site bankTotalProgress already runs at — not a separately duplicated computation',
);
assert.ok(
  /TRAIT_AXES\.flatMap\(\s*\(axis\)\s*=>\s*[\s\S]*?checkMilestones\(\s*`axisComplete:\$\{axis\}`,\s*axisVariant\(\s*tracks,\s*axis\s*\)/.test(
    crossedMilestonesForBody,
  ),
  'axisComplete:<axis> must be checked once per TRAIT_AXES axis, passing axisVariant(tracks, axis) ' +
    'as currentValue — not a hardcoded/partial axis list or a different value source',
);
assert.ok(
  !crossedMilestonesForBody.includes('bank_percent'),
  'bank_percent was removed along with profile_100 — it must not silently reappear',
);
ok('intake-sweep.tsx wires through the shared checkMilestones/persistCelebratedMilestones/crossedMilestonesFor helpers, including per-axis axisComplete checks');

const backfillEffectStart = intakeSweepSrc.indexOf('backfilledRef.current = true;');
const backfillEffectEnd = intakeSweepSrc.indexOf(
  '}, [userId, me, tracksReady, checksReady, tracks, checks, refresh]);',
);
assert.ok(
  backfillEffectStart > -1 && backfillEffectEnd > backfillEffectStart,
  'expected anchors around the backfill effect body were not found in intake-sweep.tsx — did it move or get renamed?',
);
const backfillEffectBody = intakeSweepSrc.slice(backfillEffectStart, backfillEffectEnd);
assert.ok(
  !backfillEffectBody.includes('onMilestoneCrossed'),
  'the backfill effect (T-04) must never call the toast placeholder — it is silent by design',
);
ok('backfill effect never calls onMilestoneCrossed (silent by design)');

assert.ok(
  /if \(!userId \|\| !me \|\| !tracksReady \|\| !checksReady \|\| backfilledRef\.current\) return;/.test(
    intakeSweepSrc,
  ),
  'the backfill effect must gate on checksReady too, not just tracksReady — otherwise it can mark ' +
    'itself done against an empty checks array before real checks load, then wrongly treat a real ' +
    "user's pre-existing streak as newly-crossed on their next answer",
);
ok('backfill effect gates on checksReady before computing current_streak');

const refreshAfterAnswerStart = intakeSweepSrc.indexOf('const refreshAfterAnswer = useCallback(async () => {');
const refreshAfterAnswerEnd = intakeSweepSrc.indexOf(
  '}, [refresh, loadTracks, userId, me, checks, onMilestoneCrossed]);',
);
assert.ok(
  refreshAfterAnswerStart > -1 && refreshAfterAnswerEnd > refreshAfterAnswerStart,
  'expected anchors around refreshAfterAnswer were not found in intake-sweep.tsx — did it move or get renamed?',
);
const refreshAfterAnswerBody = intakeSweepSrc.slice(refreshAfterAnswerStart, refreshAfterAnswerEnd);
assert.ok(
  refreshAfterAnswerBody.includes('onMilestoneCrossed(def)'),
  'refreshAfterAnswer (T-05) must call the toast placeholder for each newly-crossed def — removing this call should fail the suite',
);
ok('refreshAfterAnswer calls onMilestoneCrossed for newly-crossed defs');

// --- Source assertions: MilestoneToast wiring (T-06) ---
assert.ok(
  intakeSweepSrc.includes("import { MilestoneToast } from '@/components/milestone-toast';"),
  'intake-sweep.tsx imports the real MilestoneToast component',
);
assert.ok(
  !intakeSweepSrc.includes("console.log('[milestones] crossed'"),
  'the T-06 console.log placeholder for crossed milestones should be gone once the real toast is wired',
);
assert.ok(
  intakeSweepSrc.includes('setToastQueue((queue) => [...queue, def]);'),
  'onMilestoneCrossed enqueues the crossed def rather than showing it directly, so two crossings in one pass cannot clobber each other',
);
assert.ok(
  /<MilestoneToast[\s\S]*?title=\{activeToast\.title\}[\s\S]*?body=\{activeToast\.body\}[\s\S]*?\/>/.test(
    intakeSweepSrc,
  ),
  'MilestoneToast is rendered with the active queued def\'s title/body, not hardcoded copy',
);
ok('MilestoneToast is wired into onMilestoneCrossed via a queue, not hardcoded');

assert.ok(
  /<MilestoneToast[\s\S]*?key=\{activeToast\.id\}/.test(intakeSweepSrc),
  'MilestoneToast must be keyed on activeToast.id — without a key, React reuses the same instance ' +
    'across queued toasts and the second one never replays its fade-in effect',
);
ok('MilestoneToast is keyed on activeToast.id so each queued toast remounts and replays its fade');

const milestoneToastSrc = readFileSync(resolve(__dirname, '../src/components/milestone-toast.tsx'), 'utf8');
assert.ok(
  MILESTONE_DEFS.every((def) => !milestoneToastSrc.includes(def.title) && !milestoneToastSrc.includes(def.body)),
  'MilestoneToast must not hardcode any MILESTONE_DEFS title or body — they must stay props',
);
assert.ok(
  /title:\s*string/.test(milestoneToastSrc) && /body:\s*string/.test(milestoneToastSrc),
  'MilestoneToast\'s prop type must declare title and body as string props',
);
ok('MilestoneToast takes title/body as props, no hardcoded MILESTONE_DEFS copy');

// --- Source assertions: legends.tsx unlock-celebration wiring ---
const legendsSrc = readFileSync(resolve(__dirname, '../src/app/(tabs)/legends.tsx'), 'utf8');

assert.ok(
  legendsSrc.includes('const locked = tracksReady && !isProfileSettled(tracks);'),
  "legends.tsx's own isProfileSettled-based lock computation must stay byte-identical — only a " +
    'celebration is added on top of it, isProfileSettled itself is not touched',
);
assert.ok(
  legendsSrc.includes("import { MilestoneToast } from '@/components/milestone-toast';"),
  'legends.tsx imports the real MilestoneToast component',
);
assert.ok(
  legendsSrc.includes("import { persistCelebratedMilestones } from '@/lib/me';"),
  'legends.tsx imports persistCelebratedMilestones from the shared module, not a duplicated version',
);
assert.ok(
  legendsSrc.includes("import { checkMilestones, type MilestoneDef } from '@/lib/milestones';"),
  'legends.tsx imports checkMilestones from the shared module, not a duplicated version',
);

const legendsUnlockEffectStart = legendsSrc.indexOf('const celebratingUnlockRef = useRef(false);');
const legendsUnlockEffectEnd = legendsSrc.indexOf('}, [me, tracksReady, locked, refresh]);');
assert.ok(
  legendsUnlockEffectStart > -1 && legendsUnlockEffectEnd > legendsUnlockEffectStart,
  'expected anchors around the legends-unlock celebration effect were not found in legends.tsx — did it move or get renamed?',
);
const legendsUnlockEffectBody = legendsSrc.slice(legendsUnlockEffectStart, legendsUnlockEffectEnd);
assert.ok(
  legendsUnlockEffectBody.includes('if (!me || !tracksReady || locked || celebratingUnlockRef.current) return;'),
  'the celebration must gate on tracksReady AND locked, not `locked` alone — `locked` reads false ' +
    'both when genuinely unlocked and while tracks are still loading (tracksReady starts false), so ' +
    'gating on `locked` alone would fire (and permanently persist) for every unsettled profile ' +
    'during the loading window',
);
assert.ok(
  legendsUnlockEffectBody.includes("checkMilestones('profile_settled', 1, celebrated)"),
  'the celebration must check profile_settled via the shared checkMilestones, not a duplicated ' +
    "condition on `locked` directly (which would skip the celebrated_milestone_ids guard)",
);
assert.ok(
  legendsUnlockEffectBody.includes('celebratingUnlockRef.current = true;'),
  'a ref guard must prevent double-firing while the persistCelebratedMilestones request is in ' +
    'flight, since locked can flip within the same mounted session (me.updated_at is a dependency ' +
    "of legends.tsx's tracks-loading effect, not just first mount)",
);
assert.ok(
  legendsUnlockEffectBody.includes('celebratingUnlockRef.current = false;'),
  'a failed persist must reset the ref so this session can retry, mirroring intake-sweep.tsx\'s ' +
    'backfill effect — otherwise a network error silently and permanently blocks the celebration ' +
    'for this session even though celebrated_milestone_ids never actually got the id',
);
assert.ok(
  legendsUnlockEffectBody.includes('persistCelebratedMilestones(me.id,'),
  'the celebration must persist the crossed id so it never re-fires on a later visit',
);
ok('legends.tsx wires the unlock celebration through the shared checkMilestones/persistCelebratedMilestones helpers, on top of the untouched isProfileSettled-based lock, correctly gated on tracksReady');

assert.ok(
  /<MilestoneToast[\s\S]*?key=\{unlockToast\.id\}[\s\S]*?title=\{unlockToast\.title\}[\s\S]*?body=\{unlockToast\.body\}/.test(
    legendsSrc,
  ),
  'MilestoneToast must be rendered with the crossed def\'s own title/body/key, not hardcoded copy',
);
ok('legends.tsx renders MilestoneToast with the crossed def\'s title/body, keyed to remount cleanly');

console.log(`\n${passed} milestones checks passed.`);
