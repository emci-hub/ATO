/**
 * Today slot resolver. Run: npx tsx ./scripts/today-slot-check.ts
 *
 * One item below the Today card. First match wins. `none` is render-nothing.
 */
import assert from 'node:assert/strict';

import { canShowCategoryTeaser, resolveTodaySlot, type TodaySlotInput } from '../src/lib/today-slot';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const off: TodaySlotInput = {
  crisisActive: false,
  missedCheck: false,
  noteAvailable: false,
  noteOpenedToday: false,
  askPending: false,
  isSunday: false,
};

assert.deepEqual(resolveTodaySlot({ ...off, crisisActive: true }), { kind: 'crisis' });
ok('crisisActive alone resolves to crisis');

assert.deepEqual(resolveTodaySlot({ ...off, missedCheck: true }), { kind: 'missed_check' });
ok('missedCheck alone resolves to missed_check');

assert.deepEqual(resolveTodaySlot({ ...off, noteAvailable: true }), { kind: 'note' });
ok('noteAvailable alone (unopened) resolves to note');

assert.deepEqual(resolveTodaySlot({ ...off, askPending: true }), { kind: 'ask' });
ok('askPending alone resolves to ask');

assert.deepEqual(resolveTodaySlot({ ...off, isSunday: true }), { kind: 'week' });
ok('isSunday alone resolves to week');

assert.deepEqual(resolveTodaySlot(off), { kind: 'none' });
ok('all inputs false resolves to none');

assert.deepEqual(
  resolveTodaySlot({
    crisisActive: true,
    missedCheck: true,
    noteAvailable: true,
    noteOpenedToday: true,
    askPending: true,
    isSunday: true,
  }),
  { kind: 'crisis' },
);
ok('crisisActive wins over every other input set to true');

assert.deepEqual(
  resolveTodaySlot({
    ...off,
    missedCheck: true,
    noteAvailable: true,
    askPending: true,
    isSunday: true,
  }),
  { kind: 'missed_check' },
);
ok('missedCheck wins over noteAvailable, askPending, and isSunday');

assert.deepEqual(
  resolveTodaySlot({
    ...off,
    noteAvailable: true,
    noteOpenedToday: true,
    askPending: true,
  }),
  { kind: 'ask' },
);
ok('opened note falls through to ask');

assert.deepEqual(
  resolveTodaySlot({
    ...off,
    askPending: true,
    isSunday: true,
  }),
  { kind: 'ask' },
);
ok('askPending wins over isSunday');

assert.equal(canShowCategoryTeaser('crisis'), false);
assert.equal(canShowCategoryTeaser('missed_check'), false);
assert.equal(canShowCategoryTeaser('note'), true);
assert.equal(canShowCategoryTeaser('ask'), true);
assert.equal(canShowCategoryTeaser('week'), true);
assert.equal(canShowCategoryTeaser('none'), true);
ok('category teaser never shares with crisis or missed-check; may share with note/ask/week/none');

console.log(`\nAll ${passed} today-slot checks passed.`);
