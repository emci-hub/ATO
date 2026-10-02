/**
 * Insight experience — the written daily line, the identity card, and the
 * change card. Run: npm run check:daily-line
 *
 * Runs the REAL bank and the REAL picker (both are pure), then a few
 * source-text assertions for the wiring that cannot be imported offline.
 *
 * The load-bearing assertions:
 * - every line obeys the voice rules mechanically (length, no "you are", no
 *   framework word), because nobody reads 290 lines on every edit;
 * - an account never sees the same line twice inside the no-repeat window;
 * - two accounts with identical traits still get different lines;
 * - nothing private can reach the share image.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DAILY_LINES,
  DAILY_LINE_COPY_REVIEWED,
  DAILY_LINE_MAX_CHARS,
  axisOfKey,
  bankKeySets,
} from '../src/lib/daily-line/bank';
import {
  NO_REPEAT_DAYS,
  axisReactionWeights,
  clearLeans,
  eligibleLines,
  LOCK_SCREEN_PRIVATE_COPY,
  isStarterLine,
  lineStreak,
  lockScreenText,
  pickDailyLine,
  type LineDay,
} from '../src/lib/daily-line/pick';
import { addDaysYmd } from '../src/lib/local-date';
import {
  IDENTITY_FORMING_TITLE,
  identityTitle,
  identityView,
  isShareableLean,
  nextLockedPoles,
  topTraitPhrases,
} from '../src/lib/legends64/identity';
import { CHANGE_MIN_DELTA, traitChanges } from '../src/lib/trait-change';
import type { TraitHistoryRow } from '../src/lib/trait-history';
import type { TraitTrack } from '../src/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function track(axis: TraitAxis, value: number, answerCount = 4, stability = 0.8): TraitTrack {
  return {
    axis,
    track: 'report',
    value,
    stability,
    answerCount,
    lastTouched: new Date().toISOString(),
    lastDepthAt: null,
  };
}

// --- the bank ---------------------------------------------------------------
assert.equal(DAILY_LINE_COPY_REVIEWED, false);
ok('DAILY_LINE_COPY_REVIEWED is false — the bank is unreviewed draft copy');

const ids = new Set<string>();
const texts = new Set<string>();
for (const line of DAILY_LINES) {
  assert.ok(line.text.length <= DAILY_LINE_MAX_CHARS, `too long (${line.text.length}): ${line.text}`);
  assert.doesNotMatch(line.text, /\byou are\b|\byou['’]re\b/i, `"you are" in: ${line.text}`);
  assert.doesNotMatch(line.text, /\balways\b/i, `"always" in: ${line.text}`);
  assert.equal(containsFrameworkTerm(line.text), false, `framework term in: ${line.text}`);
  assert.ok(!ids.has(line.id), `duplicate id for: ${line.text}`);
  assert.ok(!texts.has(line.text), `duplicate line: ${line.text}`);
  ids.add(line.id);
  texts.add(line.text);
}
ok(`all ${DAILY_LINES.length} lines pass length, voice and framework-fence rules, with unique ids`);

for (const axis of TRAIT_AXES) {
  for (const lean of ['high', 'low'] as const) {
    const solo = DAILY_LINES.filter((l) => l.keys.length === 1 && l.keys[0] === `${axis}:${lean}`);
    assert.ok(solo.length >= 5, `${axis}:${lean} has only ${solo.length} solo lines`);
  }
}
ok('every trait lean (16 x 2) has at least 5 lines of its own');

const pairSets = bankKeySets().filter((keys) => keys.length === 2);
assert.ok(pairSets.length >= 40, `only ${pairSets.length} pair key sets`);
for (const keys of pairSets) {
  assert.notEqual(axisOfKey(keys[0]!), axisOfKey(keys[1]!), `pair on one axis: ${keys.join('+')}`);
}
assert.ok(DAILY_LINES.filter(isStarterLine).length >= 10);
ok(`${pairSets.length} two-trait tensions and a starter set exist`);

// --- the picker -------------------------------------------------------------
const fullTracks = TRAIT_AXES.map((axis, i) => track(axis, i % 2 === 0 ? 0.8 : 0.2));
const leans = clearLeans(fullTracks);
assert.equal(leans.length, TRAIT_AXES.length);

const middling = clearLeans([track('openness', 0.52), track('playfulness', 0.5)]);
assert.equal(middling.length, 0);
assert.equal(clearLeans([{ ...track('openness', 0.9), answerCount: 0 }]).length, 0);
ok('only answered traits that clearly lean to one side can earn a line');

for (const line of eligibleLines(leans)) {
  for (const key of line.keys) {
    const axis = axisOfKey(key);
    const lean = leans.find((l) => l.axis === axis);
    assert.equal(key, `${axis}:${lean?.lean}`, `line does not match the account's lean: ${line.text}`);
  }
}
ok('every eligible line matches the account on all of its keys');

const a1 = pickDailyLine({ userId: 'user-a', ymd: '2026-10-01', leans, history: [] });
const a2 = pickDailyLine({ userId: 'user-a', ymd: '2026-10-01', leans, history: [] });
assert.equal(a1.id, a2.id);
ok('the same account, day and history always give the same line');

function simulate(userId: string, days: number): LineDay[] {
  const history: LineDay[] = [];
  for (let i = 0; i < days; i += 1) {
    const ymd = addDaysYmd('2026-10-01', i);
    history.push({ ymd, id: pickDailyLine({ userId, ymd, leans, history }).id });
  }
  return history;
}

const runA = simulate('user-a', NO_REPEAT_DAYS);
assert.equal(new Set(runA.map((d) => d.id)).size, runA.length);
ok(`no line repeats for an account across ${NO_REPEAT_DAYS} days`);

const runB = simulate('user-b', NO_REPEAT_DAYS);
const sameDay = runA.filter((day, i) => day.id === runB[i]!.id).length;
assert.ok(sameDay <= 6, `two accounts with identical traits matched on ${sameDay} of ${NO_REPEAT_DAYS} days`);
ok(`two accounts with identical traits rarely share a day's line (${sameDay} of ${NO_REPEAT_DAYS})`);

const pairShare = runA.filter((d) => DAILY_LINES.find((l) => l.id === d.id)!.keys.length === 2).length;
assert.ok(pairShare >= NO_REPEAT_DAYS * 0.2, `only ${pairShare} pair lines in ${NO_REPEAT_DAYS} days`);
ok('two-trait lines make up a real share of what an account sees');

const nobody = pickDailyLine({ userId: 'new', ymd: '2026-10-01', leans: [], history: [] });
assert.equal(isStarterLine(nobody), true);
ok('an account with no clear lean gets a starter line, never a guess about them');

const reacted: LineDay[] = [{ ymd: '2026-09-30', id: a1.id, reaction: 'not_me' }];
const weights = axisReactionWeights(reacted, '2026-10-01');
for (const key of a1.keys) assert.ok((weights.get(axisOfKey(key)) ?? 1) < 1);
const liked = axisReactionWeights([{ ymd: '2026-09-30', id: a1.id, reaction: 'me' }], '2026-10-01');
for (const key of a1.keys) assert.ok((liked.get(axisOfKey(key)) ?? 1) > 1);
ok('"Not me" turns a trait down and "That’s me" turns it up for later picks');

assert.equal(lineStreak([], '2026-10-03'), 0);
assert.equal(
  lineStreak(
    [
      { ymd: '2026-10-01', id: 'x' },
      { ymd: '2026-10-02', id: 'y' },
      { ymd: '2026-10-03', id: 'z' },
    ],
    '2026-10-03',
  ),
  3,
);
assert.equal(lineStreak([{ ymd: '2026-10-01', id: 'x' }], '2026-10-03'), 0);
ok('the streak counts days in a row and resets quietly after a gap');

for (const line of DAILY_LINES) {
  const priv = line.keys.some((key) => /^attachment_|^(steadiness|competence|self_efficacy|growth_mindset|locus_of_control):low$/.test(key));
  assert.equal(lockScreenText(line), priv ? LOCK_SCREEN_PRIVATE_COPY : line.text, line.text);
}
ok('lines about closeness, worry or a struggle never reach the push or the widget');

// --- identity ---------------------------------------------------------------
const settledSix = [
  track('conscientiousness', 0.8),
  track('extraversion', 0.7),
  track('openness', 0.9),
  track('agreeableness', 0.8),
  track('conflict_assertiveness', 0.7),
  track('relatedness', 0.8),
];
const locked = nextLockedPoles(settledSix, {});
assert.equal(identityTitle(identityView(locked), 'real'), 'People-First Founder');
ok('six settled traits give the full archetype name');

const unsettled = settledSix.map((row) => ({ ...row, answerCount: 2 }));
assert.equal(identityTitle(identityView(nextLockedPoles(unsettled, {})), 'real'), IDENTITY_FORMING_TITLE);
const coreOnly = nextLockedPoles(settledSix.slice(0, 3), {});
assert.equal(identityTitle(identityView(coreOnly), 'real'), '… Founder');
ok('unsettled traits stay "forming" and a half-locked name shows the half');

const wobble = settledSix.map((row) => (row.axis === 'openness' ? { ...row, value: 0.48 } : row));
assert.equal(nextLockedPoles(wobble, locked).openness, 'H');
const crossed = settledSix.map((row) => (row.axis === 'openness' ? { ...row, value: 0.4 } : row));
assert.equal(nextLockedPoles(crossed, locked).openness, 'L');
ok('a locked letter survives a wobble and flips only on a clear crossing');

assert.equal(isShareableLean('attachment_anxiety', 'high'), false);
assert.equal(isShareableLean('attachment_avoidance', 'low'), false);
assert.equal(isShareableLean('competence', 'low'), false);
const phrases = topTraitPhrases([
  track('attachment_anxiety', 0.95),
  track('competence', 0.05),
  track('openness', 0.8),
]);
assert.deepEqual(phrases, ['Goes for the untried option']);
ok('closeness-and-worry traits and struggle-side phrases never reach the share card');

// --- change card ------------------------------------------------------------
const now = new Date('2026-10-01T12:00:00Z');
function hist(axis: TraitAxis, value: number, daysAgo: number): TraitHistoryRow {
  return {
    id: `${axis}-${daysAgo}`,
    axis,
    value,
    source: 'self_tap',
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  };
}
const changes = traitChanges(
  [
    hist('openness', 0.4, 50),
    hist('openness', 0.7, 3),
    hist('playfulness', 0.5, 20),
    hist('playfulness', 0.5 + CHANGE_MIN_DELTA / 2, 2),
    hist('autonomy', 0.2, 80),
    hist('autonomy', 0.9, 60),
  ],
  now,
);
assert.equal(changes.length, 1);
assert.equal(changes[0]!.axis, 'openness');
assert.match(changes[0]!.line, /goes for the untried option/);
assert.deepEqual(traitChanges([], now), []);
// A brand-new account: every reading is from the last few days.
assert.deepEqual(traitChanges([hist('openness', 0.2, 3), hist('openness', 0.8, 1)], now), []);
assert.equal(traitChanges([hist('openness', 0.2, 20), hist('openness', 0.8, 1)], now).length, 1);
ok('the change card reports real movement inside the window and nothing else');

// --- wiring -----------------------------------------------------------------
const home = read('src/app/(tabs)/index.tsx');
assert.match(home, /<DailyLineCard/);
assert.match(home, /todayLine: todayLineText/);
assert.match(home, /recentTitles/);
ok('Home renders the daily line and hands it, with recent titles, to the insight prompt');

for (const rel of ['src/lib/daily-line/bank.ts', 'src/lib/daily-line/pick.ts', 'src/lib/daily-line/state.ts']) {
  const src = read(rel);
  assert.doesNotMatch(src, /generateText|ai-generate|supabase/, `${rel} must stay offline`);
}
ok('the daily line never touches the model or the network');

const push = read('src/lib/push.ts');
assert.match(push, /planUpcomingLines\(/);
assert.match(push, /morningPush\(lockScreenText\(planned\[i\]!\.line\)\)/);
const cancelAll = push.slice(push.indexOf('export async function cancelAllScheduledPush'));
assert.match(cancelAll.slice(0, cancelAll.indexOf('export async function syncPushSchedule')), /cancelMorningAhead\(\)/);
ok('the morning push carries the planned line, and account deletion cancels every planned morning');

const state = read('src/lib/daily-line/state.ts');
for (const fn of ['resolveTodayLine', 'setLineReaction', 'planUpcomingLines', 'clearDailyLineState']) {
  const body = state.slice(state.indexOf(`export function ${fn}(`));
  assert.match(body.slice(0, body.indexOf('\n}\n')), /return inQueue\(async \(\) => \{/, `${fn} must write through the queue`);
}
ok('every write to the line history goes through one queue, so two writers cannot overwrite each other');

const share = read('src/lib/share.ts');
assert.match(share, /await import\('react-native-view-shot'\)/);
assert.match(share, /await import\('expo-sharing'\)/);
assert.doesNotMatch(share, /^import .* from 'react-native-view-shot'/m);
ok('share loads its native modules inside the call, so an older build cannot crash on launch');

const shareCard = read('src/components/share-card.tsx');
assert.doesNotMatch(shareCard, /value\b.*toFixed|stability|answerCount/);
ok('the share card carries no score');

const draft = read('scripts/daily-line-draft.ts');
assert.match(draft, /docs\/daily-line-candidates\.md/);
assert.doesNotMatch(draft, /bank\.ts['"`],\s*['"`]?w|writeFileSync\([^)]*bank/);
ok('the drafting script writes a review file and never writes the bank');

console.log(`\n${passed}/${passed} daily-line checks passed.`);
