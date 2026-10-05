/**
 * The polish pass (emci approved 2026-10-05): "your shape", the Home hero and
 * week strip, the sealed read, set progress, the set-done moment, the You hero,
 * your week, the token coin.
 * Run: npm run check:polish
 *
 * Pins: the new copy is draft and passes the voice rules; the week maths; no
 * new component calls a model; every new animation honours Reduce Motion; the
 * +21 coin only shows when the server paid it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { lineRuleViolation } from '../src/lib/daily-line/bank';
import { POLISH_COPY_REVIEWED, POLISH_LINES, roundRingLine } from '../src/lib/polish-copy';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';
import { lastSevenDays, mondayIndex, weekDots } from '../src/lib/week-strip';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');

// ── Copy ─────────────────────────────────────────────────────────────────────
assert.equal(POLISH_COPY_REVIEWED, false, 'new copy ships as draft until emci reads it');
for (const line of POLISH_LINES) {
  assert.equal(lineRuleViolation(line), null, `voice rule: ${line}`);
  assert.ok(!containsFrameworkTerm(line), `framework term: ${line}`);
}
assert.match(roundRingLine(11), /^11 left/);
ok(`${POLISH_LINES.length} new lines are draft and pass the moment-voice rules`);

// ── Week maths ───────────────────────────────────────────────────────────────
assert.equal(mondayIndex('2026-10-05'), 0, '2026-10-05 is a Monday');
assert.equal(mondayIndex('2026-10-11'), 6, '2026-10-11 is a Sunday');
const dots = weekDots('2026-10-08', [
  { ymd: '2026-10-05', id: 'a' },
  { ymd: '2026-10-07', id: 'b', reaction: 'me' },
  { ymd: '2026-10-08', id: 'c' },
  { ymd: '2026-10-01', id: 'old' },
]);
assert.equal(dots.length, 7);
assert.deepEqual(
  dots.map((d) => d.letter).join(''),
  'MTWTFSS',
);
assert.deepEqual(
  dots.map((d) => (d.opened ? 1 : 0)),
  [1, 0, 1, 1, 0, 0, 0],
);
assert.equal(dots.findIndex((d) => d.isToday), 3);
assert.deepEqual(
  dots.map((d) => d.future),
  [false, false, false, false, true, true, true],
);
const summary = lastSevenDays('2026-10-08', [
  { ymd: '2026-10-01', id: 'x', reaction: 'me' },
  { ymd: '2026-10-02', id: 'y', reaction: 'me' },
  { ymd: '2026-10-08', id: 'z', reaction: 'not_me' },
]);
assert.deepEqual(summary, { daysOpened: 2, thatsMe: 1 });
ok('the week strip is Monday-first, marks opened days, and a missed day is only an empty dot');

// ── No model calls in the new pieces ─────────────────────────────────────────
const newFiles = [
  'src/components/motion.tsx',
  'src/components/trait-shape.tsx',
  'src/components/shape-card.tsx',
  'src/components/week-strip.tsx',
  'src/components/progress-ring.tsx',
  'src/components/set-progress.tsx',
  'src/components/set-done-moment.tsx',
  'src/components/your-week-card.tsx',
  'src/lib/trait-shape.ts',
  'src/lib/week-strip.ts',
  'src/lib/polish-copy.ts',
];
for (const rel of newFiles) {
  assert.doesNotMatch(read(rel), /generateText|claimAiCall|ai-generate|generate[A-Z]\w*\(/, `${rel} must not call a model`);
}
ok('none of the new pieces can spend a model call');

// ── Reduce Motion ────────────────────────────────────────────────────────────
for (const rel of [
  'src/components/motion.tsx',
  'src/components/trait-shape.tsx',
  'src/components/week-strip.tsx',
  'src/components/set-done-moment.tsx',
  'src/components/today-pick-card.tsx',
  'src/components/identity-card.tsx',
]) {
  const src = read(rel);
  assert.match(src, /reduceMotion/, `${rel} must read Reduce Motion`);
}
assert.match(read('src/components/motion.tsx'), /if \(reduceMotion\) return <View style=\{style\}>\{children\}<\/View>;/);
assert.match(read('src/components/set-done-moment.tsx'), /\{reduceMotion \? null : <Confetti \/>\}/);
assert.match(read('src/components/today-pick-card.tsx'), /animated=\{!reduceMotion\}/);
ok('every new animation honours Reduce Motion (things simply appear)');

// ── The coin only when the server paid ───────────────────────────────────────
const fold = read('src/components/questions-fold.tsx');
assert.match(fold, /setMoment\(\{ kind: prev === 1 \? 'set1' : 'set2', coin: false \}\);/, 'sets 1 and 2 pay nothing');
assert.match(fold, /coin: paid && fresh,/, 'a round shows the coin only on the payout that paid it');
assert.match(
  fold,
  /claimFullProfileCompleteQuiet\(\(\) => \{\s*\/\/[^\n]*\n\s*setMoment\(\{ kind: 'all', coin: true \}\);/,
  'the 48 shows the coin only from the fresh-payout callback',
);
ok('the +21 coin appears only when +21 was really paid');

// ── Placement ────────────────────────────────────────────────────────────────
const home = read('src/app/(tabs)/index.tsx');
assert.match(home, /<WeekStrip userId=\{me\.id\} todayYmd=\{todayYmd\}/);
assert.match(home, /face=\{faceRecipe\}/);
assert.match(home, /<ProgressRing value=\{roundAnswered \?\? 0\}/);
assert.match(read('src/app/(tabs)/explore.tsx'), /<ShapeCard/);
assert.match(read('src/app/(tabs)/you.tsx'), /<YourWeekCard me=\{me\} \/>/);
assert.match(read('src/components/share-card.tsx'), /animate=\{false\}/, 'the captured share image is a still');
ok('Home, Explore, You and the share card carry the new pieces');

console.log(`\npolish-check: ${passed} passed`);
