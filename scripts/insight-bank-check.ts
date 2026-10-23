/**
 * The stored Focus · try · watch bank (emci 2026-10-07).
 * Run: npm run check:insight-bank
 *
 * Runs the REAL bank and the REAL picker (both pure), then source-text
 * assertions for the wiring that cannot be imported offline.
 *
 * The load-bearing assertions:
 * - every stored string obeys the clear voice mechanically (`tipRuleViolation`),
 *   because nobody rereads 1,600 strings on every edit;
 * - every focus wording is unique, because a stored title is how a history row
 *   is matched back to its idea;
 * - an account never gets the same idea twice inside the no-repeat window;
 * - the tags fit the chip and the database's theme cap;
 * - nothing on the insight path can reach a model call.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ClearLean } from '../src/lib/daily-line/pick';
import {
  ALL_IDEAS,
  INSIGHT_BANK_COPY_REVIEWED,
  MIXED_IDEAS,
  STARTER_IDEAS,
  STARTER_TAG_LABEL,
  TRAIT_IDEAS,
  ideaForTitle,
  ideaShareable,
  ideaTags,
  ideaTheme,
  isBankInsightTitle,
  RETIRED_FOCUS_TEXT,
  themeTags,
} from '../src/lib/insight-bank';
import {
  draftFromPick,
  eligibleMixedIdeas,
  mixedAxesFrom,
  pickIdea,
  repeatWindowDays,
  type IdeaDay,
} from '../src/lib/insight-bank/pick';
import { isShareableLean } from '../src/lib/legends64/identity';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '../src/lib/traits';
import { tipRuleViolation } from '../src/lib/voice/clear-voice';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

/** Chip width on Home, and the daily_insights.theme CHECK (wave69). */
const CHIP_MAX = 32;
const THEME_MAX = 60;

// --- counts -----------------------------------------------------------------
assert.equal(STARTER_IDEAS.length, 16, '16 starters');
for (const axis of TRAIT_AXES) {
  for (const lean of ['high', 'low'] as const) {
    const prefix = `ftw_${axis}_${lean === 'high' ? 'h' : 'l'}_`;
    const own = TRAIT_IDEAS.filter((entry) => entry.id.startsWith(prefix));
    assert.equal(own.length, 12, `${axis}:${lean} has ${own.length} ideas, needs 12`);
    for (const entry of own) {
      assert.equal(entry.keys[0], `${axis}:${lean}`, `${entry.id}: the first key must be its own lean`);
    }
  }
  // A6 (2026-10-23): three mixed ideas per trait, for someone near the middle.
  const mixedOwn = MIXED_IDEAS.filter((entry) => entry.id.startsWith(`ftw_${axis}_m_`));
  assert.equal(mixedOwn.length, 3, `${axis} has ${mixedOwn.length} mixed ideas, needs 3`);
  for (const entry of mixedOwn) {
    assert.equal(entry.mixed, axis, `${entry.id}: mixed names its own trait`);
    assert.equal(entry.keys.length, 0, `${entry.id}: a mixed idea has no lean key`);
  }
}
assert.equal(TRAIT_IDEAS.length, 384);
assert.equal(MIXED_IDEAS.length, 48);
assert.equal(ALL_IDEAS.length, 384 + 48 + 16);
ok('384 trait ideas (12 per trait lean, the 6 from before untouched), 48 mixed ideas (3 per trait) and 16 starters');
// The first six per lean are the pre-A6 ideas: their ids and focus wordings are history keys and never change.
for (const id of ['ftw_openness_h_01', 'ftw_playfulness_l_06', 'ftw_extraversion_l_06']) {
  assert.ok(TRAIT_IDEAS.some((entry) => entry.id === id), `${id} still exists`);
}

// --- ids --------------------------------------------------------------------
const ids = new Set<string>();
for (const entry of ALL_IDEAS) {
  assert.ok(!ids.has(entry.id), `duplicate id ${entry.id}`);
  ids.add(entry.id);
  assert.match(entry.id, /^ftw_([a-z_]+_[hlm]|starter)_\d{2}$/, `${entry.id}: id shape`);
  assert.ok(entry.keys.length <= 2, `${entry.id}: at most two keys`);
  if (entry.keys.length === 2) {
    assert.notEqual(entry.keys[0]!.split(':')[0], entry.keys[1]!.split(':')[0], `${entry.id}: a pair is two traits`);
  }
  if (entry.id.startsWith('ftw_starter_')) assert.equal(entry.keys.length, 0, `${entry.id}: a starter has no key`);
  if (entry.id.startsWith('ftw_starter_')) assert.equal(entry.mixed, undefined, `${entry.id}: a starter is not mixed`);
}
ok('ids are unique and stable-shaped (ftw_<axis>_<h|l|m>_<nn>, ftw_starter_<nn>)');

// --- copy rules ---------------------------------------------------------------
const failures: string[] = [];
const focusSeen = new Map<string, string>();
for (const entry of ALL_IDEAS) {
  assert.equal(entry.focus.length, 3, `${entry.id}: three focus wordings`);
  assert.equal(entry.try.length, 2, `${entry.id}: two tries`);
  assert.equal(entry.watch.length, 2, `${entry.id}: two watches`);
  const strings: [string, Parameters<typeof tipRuleViolation>[1]][] = [
    ...entry.focus.map((t) => [t, 'focus'] as [string, 'focus']),
    [entry.why, 'why'],
    ...entry.try.map((t) => [t, 'try'] as [string, 'try']),
    ...entry.watch.map((t) => [t, 'watch'] as [string, 'watch']),
  ];
  for (const [text, field] of strings) {
    const why = tipRuleViolation(text, field);
    if (why) failures.push(`${entry.id} ${field}: ${why} — "${text}"`);
  }
  for (const text of entry.focus) {
    const other = focusSeen.get(text);
    if (other) failures.push(`${entry.id}: focus repeats ${other} — "${text}"`);
    focusSeen.set(text, entry.id);
  }
}
assert.deepEqual(failures, [], `clear-voice violations:\n${failures.join('\n')}`);
ok('every focus / why / try / watch passes tipRuleViolation, and every focus wording is unique');

// --- tags -------------------------------------------------------------------
for (const entry of ALL_IDEAS) {
  const tags = ideaTags(entry);
  for (const tag of tags) assert.ok(tag.length <= CHIP_MAX, `${entry.id}: chip "${tag}" is over ${CHIP_MAX}`);
  const theme = ideaTheme(entry);
  assert.ok(theme.length <= THEME_MAX, `${entry.id}: theme "${theme}" is over ${THEME_MAX}`);
  assert.deepEqual(themeTags(theme), tags, `${entry.id}: the theme splits back into its own chips`);
  assert.doesNotMatch(theme, /_/, `${entry.id}: a tag never shows an internal trait id`);
}
assert.deepEqual(ideaTags(STARTER_IDEAS[0]!), [STARTER_TAG_LABEL]);
const anxietyIdea = TRAIT_IDEAS.find((e) => e.id === 'ftw_attachment_anxiety_h_01')!;
assert.deepEqual(ideaTags(anxietyIdea), ['Reassurance: Watchful']);
const pairIdea = TRAIT_IDEAS.find((e) => e.id === 'ftw_extraversion_l_06')!;
assert.equal(ideaTheme(pairIdea), 'Sociability: Reserved · Connection: Connected');
ok(`tags read "Short: Pole", pairs join with " · ", starters say "${STARTER_TAG_LABEL}"; chips ≤ ${CHIP_MAX}, theme ≤ ${THEME_MAX}`);

// --- privacy -------------------------------------------------------------------
assert.equal(ideaShareable(anxietyIdea), false, 'a worry lean never leaves the app');
assert.equal(ideaShareable(TRAIT_IDEAS.find((e) => e.id === 'ftw_competence_l_01')!), false);
assert.equal(ideaShareable(TRAIT_IDEAS.find((e) => e.id === 'ftw_openness_h_01')!), true);
assert.equal(ideaShareable(STARTER_IDEAS[0]!), true);
// A pair is private when either side is.
assert.equal(ideaShareable(TRAIT_IDEAS.find((e) => e.id === 'ftw_conscientiousness_h_06')!), false);
ok('ideaShareable follows isShareableLean on every key (pairs included)');

// --- reverse map ----------------------------------------------------------------
for (const entry of ALL_IDEAS) {
  entry.focus.forEach((text, variant) => {
    const hit = ideaForTitle(text);
    assert.ok(hit && hit.idea.id === entry.id && hit.variant === variant, `${entry.id}: title maps back`);
  });
}
assert.equal(isBankInsightTitle('Your shower is your thinking room.'), false, 'an AI-era title is not in the bank');
assert.equal(ideaForTitle(null), null);
for (const [oldText, currentText] of Object.entries(RETIRED_FOCUS_TEXT)) {
  const now = ideaForTitle(currentText);
  assert.ok(now, `a retired focus text points at a current one: ${currentText}`);
  assert.deepEqual(ideaForTitle(oldText), now, 'a row saved with an old focus wording still maps to its idea and variant');
}
ok('every title maps back to {idea, variant, keys}; unknown (AI-era) titles map to nothing');

// --- picker -----------------------------------------------------------------------
function lean(axis: TraitAxis, l: TraitLean, settled = true): ClearLean {
  return { axis, lean: l, settled, strength: 0.3 };
}
function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Starters when nothing is clear yet.
const starterPick = pickIdea({ userId: 'u-new', ymd: '2026-10-07', leans: [], history: [] });
assert.equal(starterPick.idea.keys.length, 0, 'no clear lean → a starter');
ok('no clear lean → a starter');

// Deterministic.
const twelve: ClearLean[] = [
  lean('openness', 'high'),
  lean('conscientiousness', 'low'),
  lean('extraversion', 'low'),
  lean('agreeableness', 'high'),
  lean('steadiness', 'high'),
  lean('attachment_anxiety', 'low'),
  lean('conflict_assertiveness', 'low'),
  lean('conflict_cooperativeness', 'high'),
  lean('autonomy', 'high'),
  lean('relatedness', 'high'),
  lean('growth_mindset', 'high'),
  lean('playfulness', 'high', false),
];
const a = pickIdea({ userId: 'u1', ymd: '2026-10-07', leans: twelve, history: [] });
const b = pickIdea({ userId: 'u1', ymd: '2026-10-07', leans: twelve, history: [] });
assert.deepEqual(a, b, 'same input, same pick');
for (const key of a.idea.keys) {
  assert.ok(twelve.some((l) => `${l.axis}:${l.lean}` === key), 'the pick matches a clear lean');
}
const draft = draftFromPick(a);
assert.equal(draft.title, a.idea.focus[a.focusIndex]);
assert.equal(draft.reflection, a.idea.why);
assert.equal(draft.theme, ideaTheme(a.idea));
ok('the picker is deterministic, matches only clear leans, and the draft maps focus/why/try/watch onto the row');

// No repeat in the window over 60 days, for the 12-lean fixture.
const pool = TRAIT_IDEAS.filter((e) => e.keys.every((k) => twelve.some((l) => `${l.axis}:${l.lean}` === k)));
const window = repeatWindowDays(pool.length);
assert.ok(window >= 30, `window ${window} too short for a 12-lean pool of ${pool.length}`);
for (const userId of ['u1', 'u2', 'u3']) {
  const history: IdeaDay[] = [];
  let ymd = '2026-10-07';
  for (let day = 0; day < 60; day += 1) {
    const pick = pickIdea({ userId, ymd, leans: twelve, history });
    for (const prior of history) {
      if (prior.ideaId === pick.idea.id) {
        const gap = Math.round((Date.parse(ymd) - Date.parse(prior.ymd)) / 86_400_000);
        assert.ok(gap > window, `${userId}: ${pick.idea.id} came back after ${gap} days (window ${window})`);
      }
    }
    history.push({ ymd, ideaId: pick.idea.id });
    ymd = addDays(ymd, 1);
  }
}
ok(`no idea repeats inside its window (${window} days for a pool of ${pool.length}) over 60 days, 3 accounts`);

// Two accounts with identical leans do not get the same day.
const other = pickIdea({ userId: 'u2', ymd: '2026-10-07', leans: twelve, history: [] });
const third = pickIdea({ userId: 'u3', ymd: '2026-10-07', leans: twelve, history: [] });
assert.ok(a.idea.id !== other.idea.id || a.idea.id !== third.idea.id, 'the pick is seeded by the account');
ok('the pick is seeded by the account');

// A returning idea moves to the next focus wording.
const target = a.idea.id;
const back = pickIdea({
  userId: 'u1',
  ymd: '2027-03-01',
  leans: twelve,
  history: [{ ymd: '2026-10-07', ideaId: target }],
});
if (back.idea.id === target) assert.equal(back.focusIndex, (a.focusIndex + 1) % 3);
ok('focus variant = (fnv1a(user|idea) + times shown) % 3');

// Mixed ideas (A6): traits answered but near the middle get their own ideas.
function track(axis: TraitAxis, value: number, answerCount = 1): TraitTrack {
  return { axis, track: 'report', value, stability: 0, answerCount, lastTouched: '2026-10-23', lastDepthAt: null };
}
const midTracks: TraitTrack[] = TRAIT_AXES.map((axis) => track(axis, 0.5));
assert.deepEqual(mixedAxesFrom(midTracks), [...TRAIT_AXES], 'every answered trait at the middle is mixed');
assert.deepEqual(mixedAxesFrom([track('openness', 0.8), track('playfulness', 0.45)]), ['playfulness'], 'a clear lean is not mixed');
assert.deepEqual(mixedAxesFrom([track('openness', 0.5, 0)]), [], 'an unanswered trait is not mixed');
assert.equal(eligibleMixedIdeas(['openness']).length, 3);
assert.ok(eligibleMixedIdeas(['openness']).every((entry) => entry.mixed === 'openness'));
const mixedPick = pickIdea({ userId: 'u-mid', ymd: '2026-10-23', leans: [], mixedAxes: ['openness', 'steadiness'], history: [] });
assert.ok(mixedPick.idea.mixed === 'openness' || mixedPick.idea.mixed === 'steadiness', 'no lean but mixed traits → a mixed idea, not a starter');
assert.equal(pickIdea({ userId: 'u-mid', ymd: '2026-10-23', leans: [], history: [] }).idea.keys.length, 0, 'no lean and no mixed trait → a starter');
const withBoth = pickIdea({ userId: 'u-both', ymd: '2026-10-23', leans: [lean('openness', 'high')], mixedAxes: ['steadiness'], history: [] });
assert.ok(withBoth.idea.keys[0] === 'openness:high' || withBoth.idea.mixed === 'steadiness', 'a lean idea or a mixed idea of a mixed trait');
assert.deepEqual(ideaTags(MIXED_IDEAS.find((e) => e.id === 'ftw_openness_m_01')!), ['Curiosity: Mixed']);
assert.equal(ideaShareable(MIXED_IDEAS.find((e) => e.id === 'ftw_openness_m_01')!), true, 'a mixed idea on an open topic may leave the app');
assert.equal(
  ideaShareable(MIXED_IDEAS.find((e) => e.id === 'ftw_attachment_anxiety_m_01')!),
  false,
  'a mixed idea follows its topic: the worry topic never reaches the lock screen, widget or share image',
);
for (const entry of MIXED_IDEAS) {
  const axis = entry.mixed!;
  assert.equal(ideaShareable(entry), isShareableLean(axis, 'high') && isShareableLean(axis, 'low'), `${entry.id}: shareable only if both sides are`);
}
// A person with ONE clear lean now has 11 ideas to cycle (the 12th is a pair idea that needs a second lean), not 5.
const oneLean = pickIdea({ userId: 'u-one', ymd: '2026-10-23', leans: [lean('openness', 'high')], history: [] });
assert.equal(TRAIT_IDEAS.filter((e) => e.keys.every((k) => k === 'openness:high')).length, 11);
assert.ok(oneLean.idea.keys.length === 1);
ok('mixed ideas: mixedAxesFrom uses the lean margin, a near-middle trait gets its mixed ideas, a single lean has 11 ideas');

// --- early read after set 1 (D22, A6) -----------------------------------------------
const insightsScreen = read('src/app/(tabs)/insights.tsx');
assert.match(insightsScreen, /intakeStage\(tracks\) >= FIRST_READ_STAGE/, 'the early read opens at set 1');
assert.match(insightsScreen, /earlyRead && userId && window/, 'the focus card shows when earlyRead');
assert.match(insightsScreen, /\bearly\b\s*\/>/, 'the early card is told it is early');
assert.doesNotMatch(
  insightsScreen.slice(insightsScreen.indexOf('!unlocked ?'), insightsScreen.indexOf(') : (', insightsScreen.indexOf('!unlocked ?'))),
  /TryTodayCard|SuperpowerCard|ConflictStyleCard|InsightsStoryCard/,
  'before the full profile only the focus card opens; Try, Story, Superpower and How you argue stay locked',
);
const focusCard = read('src/components/insights/today-focus-card.tsx');
assert.match(focusCard, /INSIGHT_EARLY_READ_COPY = 'Early read: based on your first 16 answers\. It gets more accurate as you answer more\.'/);
assert.match(focusCard, /mixedAxes: mixedAxesFrom\(tracks\)/, 'the focus card gives the picker the near-middle traits');
ok('after set 1 Insights opens the focus card with an "Early read" line; the rest stays locked until the full profile');

// --- copy-review flag: doc only, never on screen (emci 2026-10-07) ------------------
assert.equal(INSIGHT_BANK_COPY_REVIEWED, true, 'accepted by emci 2026-10-23 (roadmap A4; the table is pinned by check:copy-flags)');
assert.ok(existsSync(resolve(root, 'docs/insight-bank-review.md')), 'docs/insight-bank-review.md exists');
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}
// The Dev Hub's flag list (dev-hub-panels.tsx, behind the dev lock) is the one allowed reader.
const FLAG_LIST_FILE = 'src/components/dev-hub-panels.tsx';
for (const rel of [...sourceFiles('src/app'), ...sourceFiles('src/components')]) {
  if (rel === FLAG_LIST_FILE) continue;
  assert.doesNotMatch(read(rel), /INSIGHT_BANK_COPY_REVIEWED/, `${rel}: the bank's review flag never renders`);
}
assert.match(read(FLAG_LIST_FILE), /name: 'Daily insight \(stored\)', reviewed: INSIGHT_BANK_COPY_REVIEWED/, 'the dev flag list reads the real flag');
assert.doesNotMatch(read(FLAG_LIST_FILE), /DAILY_INSIGHT_COPY_REVIEWED/, 'the dev flag list no longer reads the stale flag');
ok('INSIGHT_BANK_COPY_REVIEWED is true (accepted 2026-10-23), has its review doc, and no screen renders it');

// --- the insight path cannot reach a model call --------------------------------------
const insightPath = [
  ...sourceFiles('src/lib/insight-bank'),
  'src/lib/insight/store.ts',
  'src/lib/insight/today-insight.ts',
  'src/app/(tabs)/index.tsx',
  'src/components/insights/today-focus-card.tsx',
  'src/app/(tabs)/insights.tsx',
];
for (const rel of insightPath) {
  const src = read(rel);
  assert.doesNotMatch(src, /\bgenerateText\b|generateDailyInsight|claimAiCall/, `${rel}: no model call on the insight path`);
  // Type-only imports are erased; a value import would pull the generator in.
  assert.doesNotMatch(src, /^import (?!type)[^;]*from '@\/lib\/insight\/generate-insight'/m, `${rel}: no value import of the generator`);
}
// Today's focus moved from Home to Insights (emci 2026-10-14).
const home = read('src/components/insights/today-focus-card.tsx');
assert.match(home, /pickIdea\(/, 'the focus card picks from the bank');
assert.match(home, /saveInsight\(/, 'the focus card saves through insert_daily_insight');
assert.doesNotMatch(home, /consentGranted/, 'the stored insight has no AI consent gate');
ok('nothing on the insight path imports generateText or the generator; the focus card picks and saves without a consent gate');

console.log(`\n${passed} insight-bank checks passed`);
