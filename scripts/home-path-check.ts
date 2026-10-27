/**
 * Home gamify (ATO-BUILD PHASE-08).
 * Run: npm run check:home-path
 *
 * Pins: the "N-day glow" streak with one free rest day a week (R21 fixtures: a
 * DST day, a timezone change, the Monday week boundary, the rest day itself);
 * "★ X brightened"; Today's path state; and, in source, that Home awards and
 * charges nothing new, the pink ring is a fixed ring under Reduce Motion (R19),
 * and the hero / path sit where the plan says.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ATO_TOKEN_EARN } from '../src/lib/ato-tokens';
import {
  BRIGHTEN_MIN_MOVE,
  PATH_QUESTIONS_TARGET,
  answeredToday,
  axisDiff,
  brightenedLine,
  pathState,
  snapshotValues,
  streakGlowLabel,
  streakWithRest,
  totalAnswered,
} from '../src/lib/home-path';
import { localYmd } from '../src/lib/local-date';
import type { TraitTrack } from '../src/lib/trait-stability';
import type { TraitAxis } from '../src/lib/traits';
import { mondayIndex } from '../src/lib/week-strip';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (rel: string) => readFileSync(resolve(rel), 'utf8');

// ── Streak: the basics ───────────────────────────────────────────────────────
assert.equal(mondayIndex('2026-10-26'), 0, '2026-10-26 is a Monday (fixtures rely on it)');
assert.deepEqual(streakWithRest(['2026-10-28', '2026-10-27', '2026-10-26'], '2026-10-28'), { streak: 3, restDays: [] });
assert.equal(streakWithRest(['2026-10-27', '2026-10-26'], '2026-10-28').streak, 2, 'today still open: yesterday keeps it');
assert.equal(streakWithRest([], '2026-10-28').streak, 0);
assert.equal(streakWithRest(['2026-10-28', '2026-10-28', '2026-10-27'], '2026-10-28').streak, 2, 'a repeated day counts once');
assert.equal(streakGlowLabel(4), '4-day glow');
ok('streak: consecutive days, an open today, nothing, repeats');

// ── The free rest day ────────────────────────────────────────────────────────
// Tue 10-27 missed, Mon 10-26 and Sun 10-25 opened: the rest day bridges, is not counted.
assert.deepEqual(streakWithRest(['2026-10-28', '2026-10-26', '2026-10-25'], '2026-10-28'), {
  streak: 3,
  restDays: ['2026-10-27'],
});
// Two misses in the SAME week: the second one ends it (week of Mon 10-19).
const sameWeek = streakWithRest(['2026-10-22', '2026-10-20'], '2026-10-22');
assert.deepEqual(sameWeek, { streak: 2, restDays: ['2026-10-21'] }, 'Mon 10-19 is a second miss in the week: it ends there');
// One rest in each of two different weeks is fine.
assert.deepEqual(streakWithRest(['2026-10-28', '2026-10-26', '2026-10-24'], '2026-10-28'), {
  streak: 3,
  restDays: ['2026-10-27', '2026-10-25'],
});
// A rest day needs a day opened before it: nothing there, the glow ends.
assert.deepEqual(streakWithRest(['2026-10-28'], '2026-10-28'), { streak: 1, restDays: [] });
// A trailing rest day is never counted, and "today still open" does not use it up.
assert.equal(streakWithRest(['2026-10-26'], '2026-10-28').streak, 1, 'yesterday missed with 10-26 before it: rest bridges but today is empty');
ok('rest day: one free miss a week bridges the glow; a second in the week, or one with nothing before it, ends it');

// ── Week boundary (Monday-first) ─────────────────────────────────────────────
// Today is Mon 10-26. Sun 10-25 (previous week) missed, Sat 10-24 and Fri 10-23 opened.
assert.deepEqual(streakWithRest(['2026-10-26', '2026-10-24', '2026-10-23'], '2026-10-26'), {
  streak: 3,
  restDays: ['2026-10-25'],
});
// Last week's rest does not use up this week's: Sun 10-25 AND Tue 10-27 both bridge.
assert.deepEqual(streakWithRest(['2026-10-28', '2026-10-26', '2026-10-24'], '2026-10-28').restDays, ['2026-10-27', '2026-10-25']);
ok('week boundary: a rest is per Monday-Sunday week; Sunday and the next Tuesday are different weeks');

// ── DST (R21) ────────────────────────────────────────────────────────────────
// New York springs forward on Sun 2026-03-08 (07:00Z). A person who opens Home at
// 23:30 local every night, 24 h apart, lands on Mar 6, Mar 7, then Mar 9 00:30:
// Mar 8 vanishes. The rest day must bridge it rather than break the glow.
const NY = 'America/New_York';
const nights = [0, 1, 2].map((i) => new Date(Date.UTC(2026, 2, 7, 4, 30) + i * 24 * 3600 * 1000));
const nightYmds = nights.map((d) => localYmd(d, NY));
assert.deepEqual(nightYmds, ['2026-03-06', '2026-03-07', '2026-03-09'], 'the spring-forward day is skipped by 24 h steps');
assert.deepEqual(streakWithRest(nightYmds, '2026-03-09'), { streak: 3, restDays: ['2026-03-08'] });
// Fall back (Sun 2026-11-01, 06:00Z): the same wall-clock hour appears twice; one YMD, counted once.
const fall = [Date.UTC(2026, 10, 1, 4, 30), Date.UTC(2026, 10, 1, 5, 30), Date.UTC(2026, 10, 1, 6, 30)]
  .map((ms) => localYmd(new Date(ms), NY));
assert.deepEqual(new Set(fall), new Set(['2026-11-01']), 'a repeated hour is still one local day');
assert.equal(streakWithRest(fall, '2026-11-01').streak, 1);
ok('DST: the skipped spring day is the free rest day; the repeated fall hour counts once');

// ── Timezone change (R21) ────────────────────────────────────────────────────
const instant = new Date(Date.UTC(2026, 9, 27, 3, 30));
assert.equal(localYmd(instant, 'America/Los_Angeles'), '2026-10-26');
assert.equal(localYmd(instant, 'Pacific/Auckland'), '2026-10-27');
// LA to Auckland: today jumps forward a day. Opened 25 and 26, today 27 not opened yet.
assert.equal(streakWithRest(['2026-10-25', '2026-10-26'], localYmd(instant, 'Pacific/Auckland')).streak, 2);
// Auckland to LA: a day opened "tomorrow" is in the future and is ignored, not counted.
const back = streakWithRest(['2026-10-27', '2026-10-25', '2026-10-24'], localYmd(instant, 'America/Los_Angeles'));
assert.equal(back.streak, 2, 'a future-dated day is not counted; the run before it still is');
ok('timezone change: a jump forward keeps the run, a jump back ignores the future day, nothing throws');

// ── ★ brightened ─────────────────────────────────────────────────────────────
const track = (axis: TraitAxis, value: number, kind: 'report' | 'game' = 'report'): TraitTrack => ({
  axis,
  track: kind,
  value,
  stability: 0.5,
  answerCount: 5,
  lastTouched: '2026-10-27T00:00:00Z',
  lastDepthAt: null,
});
const now = [track('openness', 0.7), track('extraversion', 0.52), track('steadiness', 0.5), track('agreeableness', 0.9, 'game')];
assert.deepEqual(axisDiff(null, now), [], 'a first visit brightens nothing');
const before = { openness: 0.5, extraversion: 0.5, steadiness: 0.5, agreeableness: 0.1 };
assert.deepEqual(axisDiff(before, now), ['openness'], 'only the move of 0.05 or more; the game track is ignored');
assert.ok(BRIGHTEN_MIN_MOVE === 0.05);
assert.deepEqual(axisDiff({ ...before, extraversion: 0.4, openness: 0.6 }, now), ['extraversion', 'openness'], 'biggest move first');
assert.deepEqual(snapshotValues(now), { openness: 0.7, extraversion: 0.52, steadiness: 0.5 }, 'only report tracks are stored');
assert.equal(brightenedLine([]), null);
assert.match(brightenedLine(['openness'])!, /^★ Curiosity brightened$/);
assert.match(brightenedLine(['openness', 'steadiness', 'extraversion'])!, /^★ Curiosity and 2 more brightened$/);
ok('brightened: first visit nothing, 0.05 threshold, report tracks only, biggest first, one-line copy');

// ── Today's path ─────────────────────────────────────────────────────────────
assert.equal(answeredToday(10, 7), 3);
assert.equal(answeredToday(5, 5), 0);
assert.equal(answeredToday(4, 9), 0, 'never negative');
// Round boundary (reviewer finding): the round position drops to 0 when a round ends,
// but the TOTAL only goes up. Baseline 13 answered, 3 more today = 16 total, ticks.
const rows3 = [track('openness', 0.5), track('steadiness', 0.5), track('agreeableness', 0.5, 'game')];
assert.equal(totalAnswered(rows3), 10, 'report tracks only (5 + 5); the game track is not an answer');
assert.equal(answeredToday(16, 13), 3);
assert.equal(
  pathState({ checkedIn: false, insightSeen: false, answeredTotal: 16, answeredBaseline: 13 }).done[2],
  true,
  'the step ticks across a round boundary and stays ticked',
);
const none = pathState({ checkedIn: false, insightSeen: false, answeredTotal: 4, answeredBaseline: 4 });
assert.deepEqual([none.count, none.fraction, none.allDone], [0, 0, false]);
const two = pathState({ checkedIn: true, insightSeen: true, answeredTotal: 4, answeredBaseline: 4 });
assert.deepEqual(two.done, [true, true, false]);
const all = pathState({ checkedIn: true, insightSeen: true, answeredTotal: 4 + PATH_QUESTIONS_TARGET, answeredBaseline: 4 });
assert.deepEqual([all.count, all.fraction, all.allDone], [3, 1, true]);
ok("today's path: three steps, questions counted from today's baseline, bar fraction");

// ── Economy: nothing new is awarded or charged (§1.6) ────────────────────────
assert.equal(ATO_TOKEN_EARN.daily_checkin, 5);
assert.equal(ATO_TOKEN_EARN.checkin_week_bonus, 10);
const path = read('src/components/todays-path.tsx');
const store = read('src/lib/home-path-store.ts');
const pure = read('src/lib/home-path.ts');
for (const [name, src] of [['todays-path', path], ['home-path-store', store], ['home-path', pure]] as const) {
  assert.doesNotMatch(src, /claimDailyCheckin|spendAtoTokens|\.rpc\(|supabase|generateText|claimAiCall|fetch\(/, `${name} awards, charges and calls nothing`);
  assert.doesNotMatch(src, /from '@\/play\//, `${name} stays out of src/play`);
}
assert.match(path, /`\+\$\{earned\.amount\} ✦`/, 'the "+N ✦" is the amount the server paid, never a typed number');
assert.doesNotMatch(path, /\+10|\+5\b/, 'no hard-coded token amount');
assert.doesNotMatch(path, /\bquests?\b/i,'"Today\'s path" is never called a quest');
const card = read('src/components/daily-checkin-card.tsx');
assert.match(card, /onStatus\?\.\(\{ checkedIn: true, earned: result\.delta \}\)/, 'earned comes from the server result');
ok('no price, reward or quota touched: the only amount shown is the check-in the server paid');

// ── Reduce Motion, R19, and where things sit ─────────────────────────────────
assert.match(path, /useMotionReduced/);
assert.match(path, /rm: if|if \(rm\)/);
assert.match(path, /withTiming\(state\.fraction, \{ duration: BAR_MS, easing: EASE_OUT \}\)/, 'bar fills 1000 ms EASE_OUT');
assert.match(path, /BAR_MS = 1000/);
assert.match(path, /withSpring\(done \? 1 : 0, SPRING_POP\)/, 'checkbox pops with SPRING_POP');
assert.match(path, /haptic\.success\(\)/);
assert.match(path, /haptic\.commit\(\)/);
const strip = read('src/components/week-strip.tsx');
assert.match(strip, /CELL_STAGGER_MS = 60/);
assert.match(strip, /CELL_RISE_MS = 500/);
assert.match(strip, /RING_LOOP_MS = 2400/);
assert.match(strip, /RING_GROW_PX = 4/);
assert.match(strip, /reduceMotion \? 2 : pulse\.value \* RING_GROW_PX/, 'R19: a fixed 2 px ring under Reduce Motion, no 0-4 px growth');
assert.match(strip, /reduceMotion \? 0\.45 \+ 0\.55 \* pulse\.value/, 'R19: the ring only breathes its opacity under Reduce Motion');
assert.match(strip, /reduceMotion\s*\?\s*FadeIn\.duration\(300\)/, 'cells fade (no rise) under Reduce Motion');
assert.match(strip, /useMotionActive/, 'the ring loop pauses off-screen');
assert.match(strip, /weather-night/, 'the rest day is a moon');
const chip = read('src/components/streak-chip.tsx');
assert.doesNotMatch(chip, /withRepeat|withSequence/, 'the streak chip does not move');
const chipCode = chip.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
assert.doesNotMatch(chipCode, /lose|lost|broken|repair|buy|streak (is )?at risk/i, 'no loss copy, no repair');
const id = read('src/components/identity-title-chip.tsx');
assert.match(id, /durationMs=\{SHEEN\.heroMs\}/, 'the gold key word sweeps every 3 s');
assert.match(read('src/lib/motion-tokens.ts'), /heroMs: 3000/);
const home = read('src/app/(tabs)/index.tsx');
assert.equal((home.match(/<HomeHero\b/g) ?? []).length, 1, 'one hero on Home');
assert.match(home, /bootstrapReady && !bootstrapFailed && tracksUserId === me\.id \?\s*\(\s*<HomeHero/, 'hero only once THIS account\'s tracks loaded');
assert.ok(home.indexOf('<HomeHero') < home.indexOf('<StreakChip') && home.indexOf('<StreakChip') < home.indexOf('<WeekStrip'), 'hero, then glow chip, then the week');
assert.ok(home.indexOf('<TodaysPath') > home.indexOf('STATE 2'), "Today's path is on the unlocked state only");
assert.ok(home.indexOf('<TodaysPath') < home.indexOf('<DailyCheckinCard'), "Today's path sits above the check-in card");
assert.match(home, /router\.push\('\/insights'\)/, 'the Insights link still goes to /insights');
const hero = read('src/components/home-hero.tsx');
assert.match(hero, /<Appear breathe>[\s\S]*<TraitConstellation[\s\S]*variant="hero"/);
assert.match(hero, /changedAxes=\{changed\}/);
assert.equal((hero.match(/<TraitConstellation\b/g) ?? []).length, 1);
ok('Reduce Motion + R19 ring, 60 ms cell rise, 3 s gold sheen, and the hero / glow / week / path order are pinned');

console.log(`home-path-check: ${passed} groups passed`);
