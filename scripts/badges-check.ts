/**
 * Milestone badges. Run: npm run check:badges
 *
 * Unlock is a pure function of logged Checks and stored facts. No chance.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  type BadgeCheck,
  checkWasCut,
  hasFirstFact,
  hasSevenChecks,
  hasWeekWithoutCut,
  resolveBadges,
  unlockedBadgeFixture,
  unlockedCount,
} from '../src/lib/badges';
import { addDaysYmd } from '../src/lib/local-date';
import {
  hasSeenFullProfileUnlock,
  markFullProfileUnlockSeen,
  resetFullProfileUnlockCache,
} from '../src/lib/full-profile-unlock';
import {
  applyEwmaAnswer,
  isProfileSettled,
  type TraitTrack,
} from '../src/lib/trait-stability';
import { TRAIT_AXES } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function check(partial: Partial<BadgeCheck> & { day: number; logged_on: string }): BadgeCheck {
  return {
    status: 'done',
    read_text: 'Ordinary day. Nothing to dramatize.',
    ...partial,
  };
}

function streak(startYmd: string, days: number, status: 'done' | 'skipped' = 'done'): BadgeCheck[] {
  return Array.from({ length: days }, (_, i) =>
    check({
      day: i + 1,
      logged_on: addDaysYmd(startYmd, i),
      status,
      read_text:
        status === 'skipped'
          ? 'Day skipped. Name the habit — not you.'
          : 'Ordinary day. Nothing to dramatize.',
    }),
  );
}

assert.equal(hasSevenChecks(6), false);
assert.equal(hasSevenChecks(7), true);
assert.equal(hasSevenChecks(40), true);
ok('7 Checks unlocks at 7 logged Checks, not before');

assert.equal(hasFirstFact(0), false);
assert.equal(hasFirstFact(1), true);
ok('first fact unlocks only when a Teach-Sage fact is stored');

const unlockedThenGone = resolveBadges({ checkCount: 0, factCount: 1, checks: [] });
assert.equal(unlockedThenGone.find((badge) => badge.id === 'first-fact')?.unlocked, true);
const afterLastFactDeleted = resolveBadges({ checkCount: 0, factCount: 0, checks: [] });
assert.equal(afterLastFactDeleted.find((badge) => badge.id === 'first-fact')?.unlocked, false);
ok('first-fact re-locks when the last stored fact is deleted');

assert.equal(hasWeekWithoutCut(streak('2026-08-01', 6)), false);
assert.equal(hasWeekWithoutCut(streak('2026-08-01', 7)), true);
ok('week-without-cut needs 7 consecutive calendar days, each logged, none a cut');

const gappy = [
  ...streak('2026-08-01', 4),
  ...streak('2026-08-08', 3).map((row, i) => ({ ...row, day: 5 + i })),
];
assert.equal(hasWeekWithoutCut(gappy), false);
ok('seven Checks with a calendar gap do not unlock the week');

const withSkip = streak('2026-08-01', 7);
withSkip[3] = {
  ...withSkip[3]!,
  status: 'skipped',
  read_text: 'Day skipped. Name the habit — not you.',
};
assert.equal(hasWeekWithoutCut(withSkip), false);
ok('a skip inside the 7 days blocks the week badge');

const afterSkip = [
  check({
    day: 1,
    logged_on: '2026-08-01',
    status: 'skipped',
    read_text: 'Day skipped. Name the habit — not you.',
  }),
  check({
    day: 2,
    logged_on: '2026-08-02',
    status: 'done',
    read_text: 'Day skipped. Name the habit — not you.',
  }),
  ...streak('2026-08-03', 6).map((row, i) => ({ ...row, day: i + 3 })),
];
assert.equal(hasWeekWithoutCut(afterSkip), false);
ok('the day after a skip is a cut, so 7 dones that include it do not unlock');

const afterSkipPlusOne = [
  check({
    day: 1,
    logged_on: '2026-08-01',
    status: 'skipped',
    read_text: 'Day skipped. Name the habit — not you.',
  }),
  check({
    day: 2,
    logged_on: '2026-08-02',
    status: 'done',
    read_text: 'Day skipped. Name the habit — not you.',
  }),
  ...streak('2026-08-03', 7).map((row, i) => ({ ...row, day: i + 3 })),
];
assert.equal(hasWeekWithoutCut(afterSkipPlusOne), true);
ok('a later 7-day window with no cut still unlocks (skip is not a lifetime lock)');

const prunedCut = [
  check({
    day: 1,
    logged_on: '2026-08-01',
    status: 'skipped',
    read_text: null,
  }),
  check({
    day: 2,
    logged_on: '2026-08-02',
    status: 'done',
    read_text: null,
  }),
  ...streak('2026-08-03', 6).map((row, i) => ({
    ...row,
    day: i + 3,
    read_text: null,
  })),
];
assert.equal(checkWasCut(prunedCut[1]!, prunedCut[0]), true);
assert.equal(hasWeekWithoutCut(prunedCut), false);
ok('pruned Reads still infer a cut from the previous skip — no false unlock');

const prunedClean = streak('2026-08-01', 7).map((row) => ({ ...row, read_text: null }));
assert.equal(hasWeekWithoutCut(prunedClean), true);
ok('pruned 7 consecutive dones with no prior skip still unlock');

const none = resolveBadges({ checkCount: 0, factCount: 0, checks: [] });
assert.deepEqual(
  none.map((badge) => badge.unlocked),
  [false, false, false, false],
);
ok('empty account unlocks nothing');

const fixture = unlockedBadgeFixture();
const all = resolveBadges(fixture);
assert.equal(fixture.checkCount, 11);
assert.equal(fixture.factCount, 1);
assert.equal(hasWeekWithoutCut(fixture.checks), true);
assert.deepEqual(
  all.map((badge) => badge.unlocked),
  [true, true, true, false],
);
assert.equal(unlockedCount(all), 3);
ok('fixture of 11 consecutive dones + one fact unlocks the three check/fact/week chips; full picture stays locked');

const withPicture = resolveBadges({ ...fixture, fullPicture: true });
assert.equal(withPicture.find((badge) => badge.id === 'full-picture')?.unlocked, true);
assert.equal(unlockedCount(withPicture), 4);
ok('full-picture capstone unlocks only when the profile is fully settled');

const src = readFileSync(resolve('src/lib/badges.ts'), 'utf8');
const ui = readFileSync(resolve('src/components/check-milestone-badge.tsx'), 'utf8');
assert.doesNotMatch(src, /Math\.random|Math\.floor\(\s*Math\.random|shuffle|loot|odds|chance mechanic/i);
assert.doesNotMatch(ui, /Math\.random|Math\.floor\(\s*Math\.random/i);
assert.match(src, /hasCut/);
assert.doesNotMatch(readFileSync(resolve('src/app/(tabs)/index.tsx'), 'utf8'), /MilestoneBadges/);
assert.match(readFileSync(resolve('src/app/(tabs)/you.tsx'), 'utf8'), /MilestoneBadges/);
ok('unlock path has no randomness; badges are mounted on You, not Home');

// --- full-picture predicate + one-time unlock celebration -----------------
// The capstone reads isProfileSettled (all 16 axes past the stability floor),
// not allCategoriesReady (which a bar clears on 2 of its 3 axes) — the same
// predicate every AI surface gates on, so the badge and the locks agree.
assert.match(ui, /isProfileSettled/);
assert.doesNotMatch(ui, /allCategoriesReady/);
assert.match(ui, /axes have settled/);
assert.doesNotMatch(ui, /categories have settled/);
ok('capstone unlock reads isProfileSettled, and its copy says axes not categories');

const settledTracks: TraitTrack[] = TRAIT_AXES.map((axis, i) => {
  const nowIso = new Date().toISOString();
  const value = 0.4 + ((i * 0.03) % 0.5);
  let row = applyEwmaAnswer(null, axis, 'report', value, nowIso);
  for (let n = 0; n < 7; n += 1) {
    row = applyEwmaAnswer(row, axis, 'report', value, nowIso);
  }
  return row;
});
assert.equal(isProfileSettled(settledTracks), true);
assert.equal(isProfileSettled(settledTracks.slice(1)), false);
assert.equal(isProfileSettled([]), false);
ok('capstone predicate is all-or-nothing across every axis');

// The flag is burned BEFORE the celebration renders, so a second mount in the
// same session cannot replay it, and the ack honours reduceMotion.
const markIdx = ui.indexOf('markFullProfileUnlockSeen()');
const celebrateIdx = ui.indexOf('setCelebrate(true)');
assert.ok(markIdx >= 0 && celebrateIdx > markIdx, 'seen flag is burned before celebrating');
assert.match(ui, /reduceMotion/);
assert.match(ui, /FullProfileUnlockAck/);
ok('one-time celebration burns its flag first and has a reduceMotion branch');

// --- skip-the-rest must not escape the gate -------------------------------
// "Skip the rest" defers every remaining axis into the rotating pool on the
// same screen. It must NOT navigate to Home, where nothing asks again.
const questionsTabSrc = readFileSync(resolve('src/app/(tabs)/intake-sweep.tsx'), 'utf8');
assert.doesNotMatch(questionsTabSrc, /router\.replace\('\/'\)/);
assert.match(questionsTabSrc, /function done\(\)/);
assert.match(questionsTabSrc, /scrollRef\.current\?\.scrollTo/);
assert.match(readFileSync(resolve('src/components/intake-sweep.tsx'), 'utf8'), /saveQuestionDeferral/);
ok('skip-the-rest keeps the person in Questions instead of dropping them on Home');

/**
 * The flag defaults to false so a device that has never stored it still
 * celebrates once; a read failure must fall the same way, never suppress it.
 * Async, so it runs last — these checks transpile to CJS (no top-level await).
 */
async function checkUnlockFlag(): Promise<void> {
  resetFullProfileUnlockCache();
  assert.equal(await hasSeenFullProfileUnlock(), false, 'unset flag must not suppress');
  await markFullProfileUnlockSeen();
  assert.equal(await hasSeenFullProfileUnlock(), true, 'marking is sticky in-session');
  resetFullProfileUnlockCache();
  ok('hasSeenFullProfileUnlock defaults false and sticks once marked');
}

checkUnlockFlag()
  .then(() => {
    console.log(`\nAll ${passed} badge checks passed.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
