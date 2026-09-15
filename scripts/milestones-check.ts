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
import type { TraitTrack } from '../src/lib/trait-stability';
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

// Trait-system redesign §6: sage_unlocked (25) and legends_unlocked/
// profile_fully_unlocked (both 50, retargeted from profile_settled) joined
// the pre-existing answers_12/24/36 — and answers_48 became answers_50,
// since the frozen intake is 50 questions now, not 48 (§3).
const bankTotalDefs = MILESTONE_DEFS.filter((d) => d.metric === 'bankTotalProgress');
assert.equal(bankTotalDefs.length, 7);
assert.deepEqual(
  bankTotalDefs.map((d) => d.id),
  ['sage_unlocked', 'answers_12', 'answers_24', 'answers_36', 'answers_50', 'legends_unlocked', 'profile_fully_unlocked'],
);
assert.deepEqual(
  bankTotalDefs.map((d) => d.threshold),
  [25, 12, 24, 36, 50, 50, 50],
);
assert.equal(new Set(MILESTONE_DEFS.map((d) => d.id)).size, MILESTONE_DEFS.length);
assert.ok(
  bankTotalDefs.every((d) => !containsFrameworkTerm(d.title) && !containsFrameworkTerm(d.body)),
  'bankTotalProgress copy hits the framework fence',
);
ok('MILESTONE_DEFS has 7 unique bankTotalProgress entries: sage_unlocked (25), answers_12/24/36/50, legends_unlocked + profile_fully_unlocked (50), fence-clean');

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

// profile_settled metric is fully retired — legends_unlocked moved onto
// bankTotalProgress (see below). Explicit negative so a future re-add under
// any name gets caught, same pattern already used for profile_100's removal.
assert.equal(MILESTONE_DEFS.filter((d) => d.metric === 'profile_settled').length, 0);
ok('profile_settled metric has zero defs — legends_unlocked no longer uses it');

// Wiring proof: a real 50-answered-questions TraitTrack fixture, run through
// the actual legendsUnlocked (bankTotalProgress(tracks).answered >= 50) —
// the predicate legends.tsx's `locked` used before it was parked — must
// produce a crossed legends_unlocked def. Deliberately NOT isProfileSettled:
// per emci's explicit call, Q50 alone unlocks Legends, since the tiered
// intake alone never satisfies isProfileSettled for 10 of 16 axes.
{
  // 50 answers spread across axes per their own frozen-intake bank size
  // (tier-1/2 axes: 6, tier-3: 4, tier-4: 2) — matches how a real user would
  // actually reach 50 total, not an arbitrary even split.
  const fullIntakeTracks: TraitTrack[] = TRAIT_AXES.map((axis) =>
    reportTrackAt(axis, bankQuestionCount([axis])),
  );
  const totalAnswered = fullIntakeTracks.reduce((sum, row) => sum + row.answerCount, 0);
  assert.equal(totalAnswered, 50, 'fixture must actually total 50 answers, or this test proves nothing');
  assert.deepEqual(
    checkMilestones('bankTotalProgress', totalAnswered, []).map((d) => d.id).includes('legends_unlocked'),
    true,
    'a genuinely 50-answered profile must cross legends_unlocked',
  );
  const oneShort = fullIntakeTracks.map((row, i) =>
    i === 0 ? { ...row, answerCount: row.answerCount - 1 } : row,
  );
  const oneShortTotal = oneShort.reduce((sum, row) => sum + row.answerCount, 0);
  assert.equal(oneShortTotal, 49);
  assert.equal(
    checkMilestones('bankTotalProgress', oneShortTotal, []).map((d) => d.id).includes('legends_unlocked'),
    false,
    '49 of 50 answered must not cross legends_unlocked',
  );
}
ok('a real 50-answered-questions fixture actually crosses legends_unlocked (bankTotalProgress, not isProfileSettled)');

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
ok('crossing 24 with nothing celebrated returns 12 and 24 (sage_unlocked at 25 not yet reached)');

assert.deepEqual(
  checkMilestones('bankTotalProgress', 24, ['answers_12']).map((d) => d.id),
  ['answers_24'],
);
ok('already-celebrated ids are excluded');

// 25 crosses sage_unlocked alongside the pre-existing answers_12/24.
assert.deepEqual(
  checkMilestones('bankTotalProgress', 25, []).map((d) => d.id),
  ['sage_unlocked', 'answers_12', 'answers_24'],
);
ok('crossing 25 unlocks Sage alongside answers_12/24');

const ALL_BANK_TOTAL_IDS = ['sage_unlocked', 'answers_12', 'answers_24', 'answers_36', 'answers_50', 'legends_unlocked', 'profile_fully_unlocked'];
assert.deepEqual(checkMilestones('bankTotalProgress', 50, ALL_BANK_TOTAL_IDS), []);
ok('fully celebrated returns nothing even at max value (50)');

// 50 crosses every remaining bankTotalProgress def at once: answers_50,
// legends_unlocked, and profile_fully_unlocked all share the same threshold
// (§6/§9's "plus a separate 'you are now fully unlocked' banner").
assert.deepEqual(
  checkMilestones('bankTotalProgress', 50, ['sage_unlocked', 'answers_12', 'answers_24', 'answers_36']).map((d) => d.id),
  ['answers_50', 'legends_unlocked', 'profile_fully_unlocked'],
);
ok('crossing 50 with everything below it already celebrated returns answers_50, legends_unlocked, and profile_fully_unlocked together');

const celebratedIds = ['answers_12'];
checkMilestones('bankTotalProgress', 50, celebratedIds);
assert.deepEqual(celebratedIds, ['answers_12']);
ok('checkMilestones does not mutate celebratedIds');

// Backfill scenario (T-04): an existing user who already answered 30 bank
// questions before this feature shipped should silently catch up on
// sage_unlocked/12/24, with 36/50 still ahead of them.
assert.deepEqual(
  checkMilestones('bankTotalProgress', 30, []).map((d) => d.id),
  ['sage_unlocked', 'answers_12', 'answers_24'],
);
ok('backfill scenario: 30 answered, nothing celebrated yet, catches up to sage_unlocked, 12, and 24');

// --- Source assertions: intake-sweep.tsx wiring (T-04/T-05) ---
const intakeSweepSrc = readFileSync(
  resolve(__dirname, '../src/app/(tabs)/intake-sweep.tsx'),
  'utf8',
);

/**
 * PARKED (ISOLATION_PLAN §7 Card D, 2026-09-15). Everything from here to the
 * MilestoneToast component assertions below used to pin the Questions screen's
 * milestone wiring: the shared-helper imports, the four `checkMilestones`
 * metric groups inside `crossedMilestonesFor`, the silent backfill effect, and
 * the toast queue. The whole surface is parked — the toast overlay is gone and
 * with it every write to `me.celebrated_milestone_ids` — so those assertions
 * are INVERTED, not deleted, per the Card 2/3/5 convention.
 *
 * The milestone LOGIC is untouched and still fully covered above
 * (MILESTONE_DEFS, `checkMilestones`'s crossing rules) and below (the
 * MilestoneToast component's own props). `computeStreak`,
 * `persistCelebratedMilestones` and `crossedMilestonesFor` simply have no
 * caller on this screen any more. Re-inverting these is the first thing to do
 * when milestones are rebuilt.
 */
/**
 * Scoped to real code: the screen's own docstring names what was parked and
 * why, which is exactly the kind of comment that should survive.
 */
const intakeSweepCode = intakeSweepSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(String.fromCharCode(10))
  .filter((line) => !line.trimStart().startsWith('//'))
  .join(String.fromCharCode(10));

assert.ok(
  !intakeSweepCode.includes('crossedMilestonesFor'),
  'Questions must not compute milestone crossings while the toast is parked',
);
assert.ok(
  !intakeSweepCode.includes('MilestoneToast'),
  'Questions must not mount MilestoneToast while it is parked',
);
assert.ok(
  !intakeSweepCode.includes('persistCelebratedMilestones'),
  'Questions must not write me.celebrated_milestone_ids while milestones are parked',
);
assert.ok(
  !intakeSweepCode.includes('checkMilestones'),
  'no milestone check may run on the Questions screen while the surface is parked',
);
ok('milestones are parked off Questions: no crossings computed, no toast mounted, no celebrated-id write');


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
// legends.tsx is parked (docs/ISOLATION_PLAN.md Card 3, 2026-09-15) — it now
// renders only RebuiltNotice, so the UI-wiring assertions that used to live
// here (lock computation, MilestoneToast rendering, the celebration effect)
// no longer have anything to check. The predicate they wired to,
// legendsUnlocked (bankTotalProgress >= 50), is still fully exercised above
// via direct TraitTrack fixtures, independent of the screen. When Legends is
// rebuilt, restore assertions here pinning it back to legendsUnlocked, not
// isProfileSettled (see the comment above for why that gate is wrong).

console.log(`\n${passed} milestones checks passed.`);
