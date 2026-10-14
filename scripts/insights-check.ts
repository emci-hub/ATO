/**
 * Insights behaviour (emci 2026-10-14): the cases emci named.
 *  - new user with no scores, ties, timezone / daylight-saving changes,
 *    streak edge cases (clock or zone moving back, corrupt data, double taps,
 *    missed days), duplicate "try today" hidden;
 *  - the screen's order, the provisional flag, profile-timezone "today",
 *    the gentle streak copy, the widget keys.
 * Pure logic in Node; screen order read from source.
 * Run: npm run check:insights
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CATEGORY_DEFS, readyCategories, type CategoryId, type CategoryReading } from '../src/lib/categories';
import {
  DAILY_INSIGHTS_SHOW_PROVISIONAL,
  conflictSubScores,
  currentStreak,
  emptyStore,
  emptyStreak,
  focusShowsTryToday,
  isDoneToday,
  markDone,
  parseStore,
  pickConflict,
  pickSuperpower,
  pickTryToday,
  resolveTryToday,
  shouldShowTryToday,
} from '../src/lib/daily-insights';
import { isFullProfileDone } from '../src/lib/full-profile-gate';
import { localYmd } from '../src/lib/local-date';
import type { TraitTrack } from '../src/lib/trait-stability';
import type { TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:insights'], 'tsx ./scripts/insights-check.ts');
ok('wired as check:insights (check:ota-gate runs every check:* script)');

const now = new Date('2026-10-14T12:00:00Z');
function track(axis: TraitAxis, value: number): TraitTrack {
  return {
    axis,
    track: 'report',
    value,
    stability: 1,
    answerCount: 6,
    lastTouched: '2026-10-01T00:00:00Z',
    lastDepthAt: null,
  } as TraitTrack;
}
function bar(id: CategoryId, value: number): CategoryReading {
  const def = CATEGORY_DEFS.find((d) => d.id === id)!;
  return { def, ready: true, bar: value, map: null, stableAxes: [...def.axes], texture: [] };
}

// --- 1. new user, no scores ----------------------------------------------------
{
  assert.equal(isFullProfileDone([], true), false, 'no scores: Insights stays locked');
  assert.deepEqual(readyCategories([], now), []);
  assert.equal(pickSuperpower(readyCategories([], now)), null);
  assert.equal(pickSuperpower([]), null);
  assert.equal(pickConflict([], now), null);
  assert.equal(conflictSubScores([], now), null);
  assert.equal(
    pickTryToday({ userId: 'u', dateKey: '2026-10-14', ready: [], signalAxes: [], history: [], showProvisional: false }),
    null,
  );
  const fresh = resolveTryToday(emptyStore('u'), { dateKey: '2026-10-14', ready: [], signalAxes: [], showProvisional: false });
  assert.equal(fresh.pick, null);
  assert.equal(fresh.changed, false, 'nothing is written for a user with no scores');
  const screen = read('src/app/(tabs)/insights.tsx');
  assert.match(screen, /!unlocked \? \(/, 'the screen has a locked state');
  assert.match(screen, /testID="insights-locked"/);
  assert.match(screen, /router\.push\('\/intake-sweep'\)/, 'one way forward: the questions');
  ok('new user, no scores: every card is null, nothing is stored, the screen shows one way forward');
}

// --- 2. ties ---------------------------------------------------------------------
{
  const allTied = pickSuperpower([bar('cat_steadiness', 0.7), bar('cat_drive', 0.7), bar('cat_social', 0.7)]);
  assert.equal(allTied?.superpower?.categoryId, 'cat_steadiness', 'top tie → catalog order');
  assert.equal(allTied?.kryptonite, null, 'a high tie is never a kryptonite');
  const lowTied = pickSuperpower([bar('cat_steadiness', 0.2), bar('cat_drive', 0.2)]);
  assert.equal(lowTied?.superpower, null);
  assert.equal(lowTied?.kryptonite?.categoryId, 'cat_steadiness', 'bottom tie → catalog order');
  assert.equal(pickSuperpower([bar('cat_steadiness', 0.5), bar('cat_drive', 0.5)]), null, 'a tie at 0.5 shows nothing');
  // Float noise at the midpoint never flips a side.
  assert.equal(pickSuperpower([bar('cat_steadiness', 0.5 + 1e-12)]), null);
  // Conflict ties at the split land on one fixed style.
  const tie = pickConflict([track('conflict_assertiveness', 0.5), track('conflict_cooperativeness', 0.5)], now);
  assert.equal(tie?.id, 'deal_maker');
  const sub = conflictSubScores([track('conflict_assertiveness', 0.7), track('conflict_cooperativeness', 0.3)], now);
  assert.deepEqual(sub, { assertiveness: 0.7, cooperativeness: 0.3 }, 'the helper only reads the two scores');
  ok('ties: catalog order wins, 0.5 is neither side, float noise is ignored, conflict ties are stable');
}

// --- 3. timezone + daylight saving -----------------------------------------------
{
  // "Today" is the profile zone, never the device's: one instant, two days.
  const instant = new Date('2026-10-14T05:30:00Z');
  assert.equal(localYmd(instant, 'America/Edmonton'), '2026-10-13');
  assert.equal(localYmd(instant, 'Asia/Tokyo'), '2026-10-14');
  // DST end (America/Toronto, 2026-11-01 02:00 → 01:00): the repeated hour is
  // still one calendar day, and the next midnight still starts a new one.
  assert.equal(localYmd(new Date('2026-11-01T05:30:00Z'), 'America/Toronto'), '2026-11-01');
  assert.equal(localYmd(new Date('2026-11-01T06:30:00Z'), 'America/Toronto'), '2026-11-01');
  assert.equal(localYmd(new Date('2026-11-02T04:59:00Z'), 'America/Toronto'), '2026-11-01');
  assert.equal(localYmd(new Date('2026-11-02T05:01:00Z'), 'America/Toronto'), '2026-11-02');
  // DST start (2026-03-08 02:00 → 03:00): a 23-hour day is still one day.
  assert.equal(localYmd(new Date('2026-03-08T06:30:00Z'), 'America/Toronto'), '2026-03-08');
  assert.equal(localYmd(new Date('2026-03-09T03:59:00Z'), 'America/Toronto'), '2026-03-08');
  // A streak across the DST change counts calendar days, not hours.
  let s = markDone(emptyStreak(), '2026-10-31');
  s = markDone(s, '2026-11-01');
  s = markDone(s, '2026-11-02');
  assert.equal(currentStreak(s, '2026-11-02'), 3, 'DST does not break a streak');
  // The hooks read "today" with the profile zone through the shared helper.
  const hook = read('src/hooks/use-try-today.ts');
  assert.match(hook, /localYmd\(new Date\(\), timeZone \|\| 'UTC'\)/);
  const screen = read('src/app/(tabs)/insights.tsx');
  assert.match(screen, /timeZone: me\?\.timezone/);
  assert.match(screen, /checkWindowFor\(me, \[\]\)/, 'the focus card uses the shared day window');
  assert.match(read('src/components/insights/insights-story-card.tsx'), /localYmd\(new Date\(\), me\.timezone \|\| 'UTC'\)/);
  ok('timezone + DST: profile zone decides the day; DST ends and starts keep one day; streak counts days');
}

// --- 4. streak edge cases ---------------------------------------------------------
{
  // Double tap: idempotent.
  const once = markDone(emptyStreak(), '2026-10-14');
  assert.deepEqual(markDone(once, '2026-10-14'), once);
  assert.equal(once.current, 1);
  // Clock / zone moving back: a "today" earlier than lastDone never double
  // counts, never goes negative, and still reads as done.
  const back = markDone(once, '2026-10-13');
  assert.deepEqual(back, once, 'an earlier day after lastDone changes nothing');
  assert.equal(isDoneToday(once, '2026-10-13'), true, 'a future lastDone counts as done today');
  assert.equal(currentStreak(once, '2026-10-13'), 1, 'never negative, never reset by going back');
  // Missed days: one gap day keeps it until the end of the next day, then 0.
  assert.equal(currentStreak(once, '2026-10-15'), 1);
  assert.equal(currentStreak(once, '2026-10-16'), 0, 'two days missed: reads 0 (the 🔥 line hides)');
  const restart = markDone(once, '2026-10-17');
  assert.equal(restart.current, 1, 'after a gap it starts again at 1');
  assert.equal(restart.best, 1);
  // Corrupt or foreign data: always a clean start, never a throw.
  for (const raw of ['{', 'null', '[]', '42', '{"version":9}', JSON.stringify({ version: 1, userId: 'someone-else' })]) {
    assert.deepEqual(parseStore(raw, 'u'), emptyStore('u'), `corrupt: ${raw}`);
  }
  const junk = parseStore(
    JSON.stringify({
      version: 1,
      userId: 'u',
      streak: { version: 1, doneDates: ['nope', '2026-10-14', '2026-10-14'], current: -4, best: 'x', lastDone: 5 },
      history: [{ dateKey: 'bad', id: 'x' }, null],
      picks: { bad: 'x', '2026-10-14': 3 },
    }),
    'u',
  );
  assert.deepEqual(junk.streak.doneDates, ['2026-10-14']);
  assert.equal(junk.streak.current, 0);
  assert.equal(junk.streak.lastDone, null);
  assert.deepEqual(junk.history, []);
  assert.deepEqual(junk.picks, {});
  // Gentle: the copy never shames a missed day.
  const card = read('src/components/daily-insights/try-today-card.tsx');
  // Code only: the doc comment may name what the card never says.
  const cardCode = card.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(cardCode, /lost|broke|failed|missed|shame|again\?/i);
  assert.match(card, /streak > 0 \?/, 'a 0 streak just hides the line');
  // Double tap is also guarded on the screen side (a ref, not state).
  assert.match(read('src/hooks/use-try-today.ts'), /marking\.current/);
  // The store: one key, owner inside it, wiped on sign-out (deny-by-default).
  assert.match(read('src/lib/daily-insights/store.ts'), /DAILY_INSIGHTS_STATE_KEY = 'ato\.daily-insights\.v1'/);
  assert.doesNotMatch(read('src/lib/local-account-data.ts'), /ato\.daily-insights/);
  ok('streak: double tap, clock/zone back, missed days, corrupt/foreign data, gentle copy, sign-out wipe');
}

// --- 5. duplicate "try today" hidden ----------------------------------------------
{
  assert.equal(focusShowsTryToday({ tryTodayCardShown: true }), false, 'focus hides its try line when 🎯 shows');
  assert.equal(focusShowsTryToday({ tryTodayCardShown: false }), true);
  assert.equal(shouldShowTryToday({ insightTryTodayShown: true, slotKind: 'none' }), false);
  const screen = read('src/app/(tabs)/insights.tsx');
  assert.match(screen, /focusShowsTryToday\(\{ tryTodayCardShown: tryTodayVisible \}\)/);
  assert.match(screen, /showTryToday=\{focusTry\}/);
  const focus = read('src/components/insights/today-focus-card.tsx');
  assert.match(focus, /\{showTryToday \? \(/, 'the focus card draws its try line only when asked');
  // Home no longer shows a try line at all.
  assert.doesNotMatch(read('src/app/(tabs)/index.tsx'), /insight\.tryToday|try today/);
  ok('duplicate "try today": the focus card hides its own while 🎯 shows; Home shows none');
}

// --- 6. order, flags, widget -------------------------------------------------------
{
  const screen = read('src/app/(tabs)/insights.tsx');
  const order = ['<TryTodayCard', '<TodayFocusCard', '<InsightsStoryCard', '<SuperpowerCard', '<ConflictStyleCard'].map(
    (tag) => screen.indexOf(tag),
  );
  assert.ok(order.every((i) => i > 0), 'all five cards are on the screen');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'Try → focus → Story → Superpower → How you argue');
  assert.equal(DAILY_INSIGHTS_SHOW_PROVISIONAL, false, 'Love / Independence / Structure stay behind the flag');
  // The widget gets the 🎯 line through the card-era keys.
  const widget = read('src/lib/insight/today-insight.ts');
  assert.match(widget, /export function writeWidgetTryToday\(text: string, ymd: string\)/);
  const write = widget.slice(widget.indexOf('export function writeWidgetTryToday'));
  assert.match(write, /storage\.set\('read', text\)/);
  assert.match(write, /storage\.set\('do', WIDGET_TRY_TODAY_FOLLOW_UP\)/);
  assert.match(write, /storage\.set\('hasCard', '1'\)/);
  assert.match(read('src/hooks/use-try-today.ts'), /writeWidgetTryToday\(next\.line\.text, today\)/);
  assert.match(read('src/app/(tabs)/index.tsx'), /useTryToday\(/, 'Home feeds the widget even if Insights is never opened');
  ok('order is Try → focus → Story → Superpower → How you argue; provisional off; widget uses the old keys');
}

// --- 7. Story is template-only -------------------------------------------------------
{
  const story = read('src/components/insights/insights-story-card.tsx');
  assert.match(story, /pickStoryTemplate\(/);
  assert.match(story, /source === 'template' \|\| story\.card\.source === 'bank'/, 'old AI cards are not shown');
  const storyCode = story.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(storyCode, /write one now|Write me a brand-new story|AI_PRICE_LABEL|consent/i);
  ok('the Story card is template-only: no AI card, no "write one now", no tokens, no consent');
}

console.log(`\ninsights: ${passed} checks passed`);
