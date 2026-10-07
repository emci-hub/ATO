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
  STARTER_IDEAS,
  STARTER_TAG_LABEL,
  TRAIT_IDEAS,
  ideaForTitle,
  ideaShareable,
  ideaTags,
  ideaTheme,
  isBankInsightTitle,
  themeTags,
} from '../src/lib/insight-bank';
import { draftFromPick, pickIdea, repeatWindowDays, type IdeaDay } from '../src/lib/insight-bank/pick';
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
    assert.equal(own.length, 6, `${axis}:${lean} has ${own.length} ideas, needs 6`);
    for (const entry of own) {
      assert.equal(entry.keys[0], `${axis}:${lean}`, `${entry.id}: the first key must be its own lean`);
    }
  }
}
assert.equal(TRAIT_IDEAS.length, 192);
ok('192 trait ideas (6 per trait lean) and 16 starters');

// --- ids --------------------------------------------------------------------
const ids = new Set<string>();
for (const entry of ALL_IDEAS) {
  assert.ok(!ids.has(entry.id), `duplicate id ${entry.id}`);
  ids.add(entry.id);
  assert.match(entry.id, /^ftw_([a-z_]+_[hl]|starter)_\d{2}$/, `${entry.id}: id shape`);
  assert.ok(entry.keys.length <= 2, `${entry.id}: at most two keys`);
  if (entry.keys.length === 2) {
    assert.notEqual(entry.keys[0]!.split(':')[0], entry.keys[1]!.split(':')[0], `${entry.id}: a pair is two traits`);
  }
  if (entry.id.startsWith('ftw_starter_')) assert.equal(entry.keys.length, 0, `${entry.id}: a starter has no key`);
}
ok('ids are unique and stable-shaped (ftw_<axis>_<h|l>_<nn>, ftw_starter_<nn>)');

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

// --- copy-review flag: doc only, never on screen (emci 2026-10-07) ------------------
assert.equal(INSIGHT_BANK_COPY_REVIEWED, false, 'unreviewed until emci ticks the review doc');
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
for (const rel of [...sourceFiles('src/app'), ...sourceFiles('src/components')]) {
  assert.doesNotMatch(read(rel), /INSIGHT_BANK_COPY_REVIEWED/, `${rel}: the bank's review flag never renders`);
}
ok('INSIGHT_BANK_COPY_REVIEWED is false, has its review doc, and no screen renders it');

// --- the insight path cannot reach a model call --------------------------------------
const insightPath = [
  ...sourceFiles('src/lib/insight-bank'),
  'src/lib/insight/store.ts',
  'src/lib/insight/today-insight.ts',
  'src/app/(tabs)/index.tsx',
];
for (const rel of insightPath) {
  const src = read(rel);
  assert.doesNotMatch(src, /\bgenerateText\b|generateDailyInsight|claimAiCall/, `${rel}: no model call on the insight path`);
  // Type-only imports are erased; a value import would pull the generator in.
  assert.doesNotMatch(src, /^import (?!type)[^;]*from '@\/lib\/insight\/generate-insight'/m, `${rel}: no value import of the generator`);
}
const home = read('src/app/(tabs)/index.tsx');
assert.match(home, /pickIdea\(/, 'Home picks from the bank');
assert.match(home, /saveInsight\(/, 'Home saves through insert_daily_insight');
assert.doesNotMatch(home, /if \(!consentGranted\) return;\s*const \{ todayDay/, 'the stored insight has no AI consent gate');
ok('nothing on the insight path imports generateText or the generator; Home picks and saves without a consent gate');

console.log(`\n${passed} insight-bank checks passed`);
