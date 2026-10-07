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
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  BANK_IS_LOADED,
  DAILY_LINES,
  DAILY_LINE_COPY_REVIEWED,
  allLines,
  axisOfKey,
  dailyLineById,
  leanTag,
  lineId,
  lineRuleViolation,
  parseLeanTag,
  registerPoolLines,
  resetPoolLines,
} from '../src/lib/daily-line/bank';
import { MIN_PER_LEAN, MIN_STARTERS, REVIEW_FILE, parseReviewFile, planLoad } from './daily-line-load';
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
assert.equal(DAILY_LINE_COPY_REVIEWED, true);
assert.equal(BANK_IS_LOADED, true, 'the reviewed flag is only honest while the shipped bank is the loaded, approved one');
ok('DAILY_LINE_COPY_REVIEWED is true — emci approved the loaded bank (2026-10-02)');

const ids = new Set<string>();
const texts = new Set<string>();
for (const line of DAILY_LINES) {
  // The first-draft lines end on a suggestion; picked lines may not.
  const violation = lineRuleViolation(line.text, { allowAdvice: !BANK_IS_LOADED });
  assert.equal(violation, null, `${violation}: ${line.text}`);
  assert.ok(!ids.has(line.id), `duplicate id for: ${line.text}`);
  assert.ok(!texts.has(line.text), `duplicate line: ${line.text}`);
  ids.add(line.id);
  texts.add(line.text);
}
ok(`all ${DAILY_LINES.length} shipped lines pass the line rules, with unique ids`);

for (const axis of TRAIT_AXES) {
  for (const lean of ['high', 'low'] as const) {
    const solo = DAILY_LINES.filter((l) => l.keys.length === 1 && l.keys[0] === `${axis}:${lean}`);
    assert.ok(solo.length >= MIN_PER_LEAN, `${axis}:${lean} has only ${solo.length} solo lines`);
  }
}
assert.ok(DAILY_LINES.filter(isStarterLine).length >= MIN_STARTERS);
ok(`every trait lean (16 x 2) has at least ${MIN_PER_LEAN} shipped lines, and there is a starter set`);

assert.equal(lineRuleViolation('You said "maybe" so you could cancel from the couch.'), null);
assert.equal(lineRuleViolation('You are a planner.'), 'says "you are"');
assert.equal(lineRuleViolation('You went quiet. Try saying one thing.'), 'gives advice');
assert.equal(lineRuleViolation('Ask them first.'), 'gives advice');
assert.equal(lineRuleViolation('"Come with me," you said, about a plan that was not up for discussion.'), null);
assert.match(lineRuleViolation('x'.repeat(121)) ?? '', /too long/);
assert.equal(lineRuleViolation('Your attachment style showed.'), 'framework term');
ok('the line rules reject "you are", advice, over-long lines and framework words, and pass a plain moment');

assert.deepEqual(parseLeanTag('starter'), []);
assert.deepEqual(parseLeanTag('openness:high+autonomy:low'), ['openness:high', 'autonomy:low']);
assert.equal(parseLeanTag('openness:high+openness:low'), null);
assert.equal(parseLeanTag('charisma:high'), null);
assert.equal(parseLeanTag('openness:mid'), null);
assert.equal(leanTag([]), 'starter');
ok('a pool tag is a starter, one known lean, or two leans on different traits — nothing else');

// --- the review file and the loader -------------------------------------------
const review = parseReviewFile(read(REVIEW_FILE));
assert.ok(review.length >= 300, `only ${review.length} candidates in ${REVIEW_FILE}`);
for (const line of review) {
  assert.ok(parseLeanTag(line.tag), `unknown heading \`${line.tag}\` in ${REVIEW_FILE}`);
  const violation = lineRuleViolation(line.text);
  assert.equal(violation, null, `${violation}: ${line.text}`);
}
assert.equal(new Set(review.map((l) => l.text)).size, review.length, 'a candidate appears twice');
const everything = planLoad(review, true);
assert.deepEqual(everything.problems, [], 'loading every candidate must be possible');
const pairTags = new Set(review.filter((l) => l.tag.includes('+')).map((l) => l.tag));
assert.ok(pairTags.size >= 40, `only ${pairTags.size} two-trait headings`);
ok(`all ${review.length} review candidates pass the new-style rules and cover every lean and ${pairTags.size} tensions`);

const nothing = planLoad(
  review.map((l) => ({ ...l, ticked: false })),
  false,
);
assert.ok(nothing.problems.some((problem) => /needs/.test(problem)));
const bad = planLoad([{ tag: 'openness:high', text: 'You are curious.', ticked: true }], false);
assert.ok(bad.problems.some((problem) => /you are/.test(problem)));
ok('the loader refuses a thin pick and a rule-breaking line instead of shipping them');

// --- the pool registry ----------------------------------------------------------
resetPoolLines();
const before = allLines().length;
const aiText = 'You alphabetized the spices and told nobody.';
assert.equal(
  registerPoolLines([
    { tag: 'conscientiousness:high', text: aiText, source: 'ai' },
    { tag: 'conscientiousness:high', text: 'You are tidy.', source: 'ai' },
    { tag: 'not-a-lean', text: 'You kept the receipt.', source: 'ai' },
    { tag: leanTag(DAILY_LINES[0]!.keys), text: DAILY_LINES[0]!.text, source: 'ai' },
  ]),
  1,
);
assert.equal(allLines().length, before + 1);
assert.equal(dailyLineById(lineId(aiText))?.source, 'ai');
assert.equal(dailyLineById(DAILY_LINES[0]!.id)?.source, 'authored');
assert.equal(lockScreenText(dailyLineById(lineId(aiText))!), LOCK_SCREEN_PRIVATE_COPY);
resetPoolLines();
assert.equal(allLines().length, before);
assert.equal(dailyLineById(lineId(aiText)), null);
ok('pool lines join the picker only if they pass the rules; an AI line never reaches the lock screen; sign-out forgets them');

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
// The number of two-trait lines a profile can draw on depends on the bank.
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
// Name styles v2 (2026-10-05): two-word styles are whole at six traits; the
// three-word default (Primal Genius) shows "…" until its third word settles.
assert.equal(identityTitle(identityView(locked), 'highFantasy'), 'Golden Pathfinder');
assert.equal(identityTitle(identityView(locked), 'primal'), '… Warm Ringmaster');
const settledNine = [
  ...settledSix,
  track('growth_mindset', 0.8),
  track('steadiness', 0.8),
  track('playfulness', 0.2),
];
const lockedNine = nextLockedPoles(settledNine, {});
assert.equal(identityTitle(identityView(lockedNine), 'primal'), 'Hungry Warm Ringmaster');
assert.equal(identityTitle(identityView(lockedNine), 'oxymoron'), 'Polite Overachiever Leader');
ok('six settled traits give the two-word name; nine give the three-word name');

const unsettled = settledSix.map((row) => ({ ...row, answerCount: 2 }));
assert.equal(identityTitle(identityView(nextLockedPoles(unsettled, {})), 'primal'), IDENTITY_FORMING_TITLE);
const coreOnly = nextLockedPoles(settledSix.slice(0, 3), {});
assert.equal(identityTitle(identityView(coreOnly), 'highFantasy'), '… Pathfinder');
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
assert.match(home, /<TodayPickCard/);
// The insight stopped being a prompt on 2026-10-07 (stored bank, emci): it is
// picked from the same clear leans the daily line reads, so the two agree.
assert.match(home, /pickIdea\(\{ userId, ymd: todayYmd, leans: clearLeans\(tracks\), history \}\)/);
ok('Home renders the daily line and picks the stored insight from the same clear leans');

for (const rel of ['src/lib/daily-line/bank.ts', 'src/lib/daily-line/pick.ts', 'src/lib/daily-line/state.ts']) {
  const src = read(rel);
  assert.doesNotMatch(src, /generateText|ai-generate|from '@\/lib\/supabase'/, `${rel} must stay offline`);
}
for (const rel of ['src/lib/daily-line/pool-store.ts', 'src/lib/daily-line/sync.ts']) {
  assert.doesNotMatch(read(rel), /generateText|ai-generate/, `${rel} must never call the model`);
}
ok('the bank, picker and phone copy stay offline; the database sync never calls the model');

// --- the database (wave77), copied from the question pool ------------------------
const wave = read('supabase/migrations/wave77_daily_lines.sql');
assert.match(
  wave,
  /create policy daily_line_pool_select_auth on public\.daily_line_pool\s+for select to authenticated\s+using \(source = 'authored' or created_by = auth\.uid\(\)\);/,
);
assert.match(wave, /revoke insert, update, delete on public\.daily_line_pool from public, anon, authenticated;/);
assert.match(
  wave,
  /create policy daily_line_days_select_own on public\.daily_line_days\s+for select to authenticated\s+using \(auth\.uid\(\) = user_id\);/,
);
assert.match(wave, /revoke insert, update, delete on public\.daily_line_days from public, anon, authenticated;/);
assert.match(wave, /user_id uuid not null references auth\.users\(id\) on delete cascade/);
ok('wave77: authored lines are shared, AI lines and day rows are owner-only, and neither table takes a direct write');

for (const fn of ['insert_daily_line_pool_items(jsonb)', 'record_daily_line(date, text)', 'react_daily_line(date, text)', 'clear_my_daily_lines()']) {
  const name = fn.replace(/[()]/g, '\\$&');
  assert.match(wave, new RegExp(`revoke all on function public\\.${name} from public, anon;`), `${fn} revoke`);
  assert.match(wave, new RegExp(`grant execute on function public\\.${name} to authenticated;`), `${fn} grant`);
}
assert.equal((wave.match(/security definer\s+set search_path = public/g) ?? []).length, 4);
assert.equal((wave.match(/raise exception 'not authenticated' using errcode = '28000';/g) ?? []).length, 4);
assert.doesNotMatch(wave, /drop |alter table public\.(?!daily_line)|create or replace/i);
ok('wave77: every function is security definer with a pinned search_path, refuses a signed-out caller, and nothing existing is altered');

const capSql = /char_length\(line\) between 1 and (\d+)/.exec(wave)?.[1];
assert.ok(Number(capSql) >= 120, 'the pool line cap must not be shorter than DAILY_LINE_MAX_CHARS');
assert.match(wave, /values \(v_key, v_line, 'ai', uid\)/);
ok('wave77: the pool accepts every line the app allows, and AI rows are stamped with their owner');

const gen = read('src/lib/insight/generate-insight.ts');
assert.match(gen, /export function parseInsightLines\(/);
assert.match(gen, /return \{ draft, lines: parseInsightLines\(text, groundedLeans\(grounding\.tracks\)\) \};/);
const sync = read('src/lib/daily-line/sync.ts');
assert.match(sync, /lineRuleViolation\(text\) \?\?/);
ok('AI lines ride on the insight call, and each is run through the line rules before it is kept');

// 2026-10-05: Today's Pick replaced the line card on Home. Its share image
// carries the question only (never the answer, never an AI line).
const pickCard = read('src/components/today-pick-card.tsx');
assert.match(pickCard, /content=\{\{ kind: 'line', text: pick\.prompt \}\}/);
assert.ok(!existsSync(resolve(__dirname, '..', 'src/components/daily-line-card.tsx')), 'the old line card is gone');
ok('the Today’s Pick share image carries the question only');

const push = read('src/lib/push.ts');
assert.match(push, /const pick = pickForYmd\(addDaysYmd\(todayYmd, offsets\[i\]!\)\);/);
assert.match(push, /morningPush\(pick\.prompt\)/);
const cancelAll = push.slice(push.indexOf('export async function cancelAllScheduledPush'));
assert.match(cancelAll.slice(0, cancelAll.indexOf('export async function syncPushSchedule')), /cancelMorningAhead\(\)/);
ok('each morning push asks that day’s pick, and account deletion cancels every planned morning');

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

console.log(`\n${passed}/${passed} daily-line checks passed.`);
