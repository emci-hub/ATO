/**
 * Home reveal. Run: npm run check:reveal
 *
 * Priority-pick like Nudge. No chance. Same unfold for every kind.
 * Empty days are a plain line, never a sealed miss.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { addDaysYmd } from '../src/lib/local-date';
import {
  REVEAL_EMPTY,
  REVEAL_LABEL,
  REVEAL_PROXIMITY_MAX,
  REVEAL_SEALED_PROMPT,
  REVEAL_UNFOLD_MS,
  findBadgeProximity,
  findRevealSignal,
  resolveReveal,
  type RevealCheck,
} from '../src/lib/reveal';
import { QUOTA_EMPTY_MESSAGE } from '../src/lib/voice/quota';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

assert.equal(REVEAL_LABEL, 'Note');
assert.equal(REVEAL_SEALED_PROMPT, 'Open');
assert.ok(REVEAL_UNFOLD_MS >= 200 && REVEAL_UNFOLD_MS <= 400);
ok('label is Note; unfold is 200–400ms');

assert.equal(REVEAL_EMPTY, 'Nothing extra to notice today.');
assert.doesNotMatch(REVEAL_EMPTY, /back tomorrow|come back tomorrow/i);
assert.notEqual(REVEAL_EMPTY, QUOTA_EMPTY_MESSAGE);
ok('empty line is calm and does not borrow the quota cadence');

const now = new Date('2026-08-28T18:00:00Z');
const tz = 'UTC';

function check(
  partial: Partial<RevealCheck> & { day: number; logged_on: string },
): RevealCheck {
  return {
    status: 'done',
    read_text: 'Ordinary day. Nothing to dramatize.',
    do_text: 'After you make coffee, sit one minute.',
    ...partial,
  };
}

const weekTwo = [
  check({ day: 1, logged_on: '2026-08-24' }),
  check({ day: 2, logged_on: '2026-08-25' }),
  check({ day: 3, logged_on: '2026-08-26' }),
];

const weekPick = resolveReveal({
  checks: weekTwo,
  facts: ['I finish work at four'],
  checkCount: 3,
  factCount: 1,
  timeZone: tz,
  now,
});
assert.equal(weekPick?.kind, 'week-pattern');
assert.match(weekPick?.text ?? '', /showed up on 3 Checks this week/);
assert.doesNotMatch(weekPick?.text ?? '', /Ordinary day|After you make coffee/);
ok('week pattern wins over a stored fact; copy does not reprint Read/Do');

const oneCheck = [check({ day: 1, logged_on: '2026-08-26' })];
const factPick = resolveReveal({
  checks: oneCheck,
  facts: ['I finish work at four'],
  checkCount: 4,
  factCount: 1,
  timeZone: tz,
  now,
});
assert.equal(factPick?.kind, 'fact');
assert.match(factPick?.text ?? '', /Still true: I finish work at four/);
ok('one Check is not a week pattern; latest safe fact is next');

const afterFactDeleted = resolveReveal({
  checks: oneCheck,
  facts: [],
  checkCount: 4,
  factCount: 0,
  timeZone: tz,
  now,
});
assert.equal(afterFactDeleted?.kind, 'badge-proximity');
ok('deleting the last fact drops the Reveal fact branch; next real signal still wins');

const afterFactDeletedEmpty = resolveReveal({
  checks: oneCheck,
  facts: [],
  checkCount: 0,
  factCount: 0,
  timeZone: tz,
  now,
});
assert.equal(afterFactDeletedEmpty, null);
ok('deleting the last fact with no other signal is empty, not a stale fact line');

const badgePick = resolveReveal({
  checks: oneCheck,
  facts: [],
  checkCount: 4,
  factCount: 0,
  timeZone: tz,
  now,
});
assert.equal(badgePick?.kind, 'badge-proximity');
assert.equal(badgePick?.text, '3 Checks from the 7-Check mark.');
ok('badge-proximity is 3 Checks from the 7-Check mark when nothing else is real');

assert.equal(REVEAL_PROXIMITY_MAX, 3);
const far = resolveReveal({
  checks: oneCheck,
  facts: [],
  checkCount: 3,
  factCount: 0,
  timeZone: tz,
  now,
});
assert.equal(far, null);
ok('4 Checks remaining is not proximity');

const empty = resolveReveal({
  checks: [],
  facts: [],
  checkCount: 0,
  factCount: 0,
  timeZone: tz,
  now,
});
assert.equal(empty, null);
ok('empty pool returns null — no manufactured filler');

assert.equal(
  resolveReveal({
    checks: weekTwo,
    facts: ['I finish work at four'],
    checkCount: 3,
    factCount: 1,
    timeZone: tz,
    now,
    crisisToday: true,
  }),
  null,
);
ok('crisis day yields empty, not a sealed object');

assert.equal(
  findRevealSignal({
    checks: oneCheck,
    facts: ['I want to die tomorrow'],
    checkCount: 1,
    factCount: 1,
    timeZone: tz,
    now,
  }),
  null,
);
ok('crisis-keyword facts are not reflected back');

const skipWeek = [
  check({ day: 1, logged_on: '2026-08-24', status: 'skipped', read_text: 'Day skipped.' }),
  check({ day: 2, logged_on: '2026-08-25', status: 'skipped', read_text: 'Day skipped.' }),
];
const skipPick = resolveReveal({
  checks: skipWeek,
  facts: [],
  checkCount: 2,
  factCount: 0,
  timeZone: tz,
  now,
});
assert.equal(skipPick?.kind, 'week-pattern');
assert.match(skipPick?.text ?? '', /more than one skip/);
ok('two skips this week is a real Read/Do pattern');

const cleanDays: RevealCheck[] = [];
for (let i = 0; i < 5; i += 1) {
  cleanDays.push(
    check({
      day: i + 1,
      logged_on: addDaysYmd('2026-08-24', i),
    }),
  );
}
const weekStreak = resolveReveal({
  checks: cleanDays,
  facts: [],
  checkCount: 8,
  factCount: 0,
  timeZone: tz,
  now,
});
assert.equal(weekStreak?.kind, 'week-pattern');
ok('week pattern still wins when a clean streak is also close');

const weekCutProx = findBadgeProximity({
  checks: cleanDays,
  checkCount: 8,
  timeZone: tz,
  todayYmd: '2026-08-28',
});
assert.equal(weekCutProx?.text, '2 days from a week without a cut.');
ok('badge-proximity can name days from a week without a cut when 7-Checks is already unlocked');

assert.doesNotMatch(read('src/lib/reveal.ts'), /Math\.random|shuffle|loot|odds/);
ok('resolver has no chance mechanic');

const card = read('src/components/reveal-card.tsx');
assert.match(card, /REVEAL_UNFOLD_MS/);
assert.doesNotMatch(card, /pick\.kind|kind === |withSequence/);
assert.doesNotMatch(card, /backgroundColor:.*kind|burst/);
assert.match(card, /Vibration\.vibrate\(10\)/);
assert.doesNotMatch(card, /Vibration\.vibrate\([^)]+\).*Vibration\.vibrate/s);
assert.match(card, /reduceMotion|forceReduceMotion/);
assert.match(card, /REVEAL_EMPTY/);
assert.match(card, /testID="reveal-empty"/);
assert.match(card, /testID="reveal-sealed"/);
ok('one unfold, one short haptic, no kind-based chrome');

const home = read('src/app/(tabs)/index.tsx');
assert.match(home, /RevealCard/);
assert.doesNotMatch(read('src/app/(tabs)/circle.tsx'), /RevealCard|REVEAL_LABEL/);
assert.doesNotMatch(read('src/app/dawn.tsx'), /RevealCard/);
assert.doesNotMatch(read('targets/widget/widgets.swift'), /RevealCard|REVEAL_/);
assert.doesNotMatch(read('src/lib/push-copy.ts'), /REVEAL_|RevealCard/);
assert.doesNotMatch(read('src/lib/today-card.ts'), /reveal/);
ok('Reveal is Home-only; widget/push/Circle/Dawn stay closed');

const lab = read('src/app/theme-lab.tsx');
assert.match(lab, /THEME_REVEAL_WEEK/);
assert.match(lab, /THEME_REVEAL_FACT/);
assert.match(lab, /forceReduceMotion/);
assert.match(lab, /pick=\{null\}/);
ok('theme-lab has week, fact, Reduce Motion, and empty fixtures');

console.log(`\n${passed} checks passed`);
