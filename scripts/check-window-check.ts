/**
 * Check calendar window + weekly Read/Do keep cap.
 * Run: npx tsx scripts/check-window-check.ts
 */
import assert from 'node:assert/strict';

import {
  BACKDATE_DAYS,
  canLogDay,
  checkWindowFor,
  journeyDay,
  openLogDays,
  shouldKeepCheckText,
  textKeepStartYmd,
  TEXT_KEEP_LOOKBACK_DAYS,
} from '../src/lib/check-window';
import { addDaysYmd, daysBetweenYmd } from '../src/lib/local-date';
import { checksInRecapWeek, recapWeekRange } from '../src/lib/week-window';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.equal(daysBetweenYmd('2026-08-23', '2026-08-27'), 4);
assert.equal(journeyDay('2026-08-23', '2026-08-23'), 1);
assert.equal(journeyDay('2026-08-23', '2026-08-27'), 5);
ok('journey day is 1-based from signup-local date');

const epoch = '2026-08-17';
const today = '2026-08-27';
assert.equal(journeyDay(epoch, today), 11);

const open = openLogDays({ epochYmd: epoch, todayYmd: today, loggedDays: [] });
assert.deepEqual(
  open.map((slot) => slot.day),
  [9, 10, 11],
);
assert.deepEqual(
  open.map((slot) => slot.ymd),
  ['2026-08-25', '2026-08-26', '2026-08-27'],
);
ok('day 11 open window is 9, 10, 11 — not 8');

assert.equal(BACKDATE_DAYS, 2);
assert.equal(
  canLogDay({
    epochYmd: epoch,
    todayYmd: today,
    day: 9,
    loggedOnYmd: '2026-08-25',
    loggedDays: [],
  }).ok,
  true,
);
assert.equal(
  canLogDay({
    epochYmd: epoch,
    todayYmd: today,
    day: 8,
    loggedOnYmd: '2026-08-24',
    loggedDays: [],
  }).ok,
  false,
);
ok('2 days back is loggable; 3+ days back is closed');

const afterNine = openLogDays({ epochYmd: epoch, todayYmd: today, loggedDays: [9] });
assert.deepEqual(
  afterNine.map((slot) => slot.day),
  [10, 11],
);
ok('one Check per day: logging day 9 does not open a second Check that day');

assert.equal(
  (canLogDay({
    epochYmd: epoch,
    todayYmd: today,
    day: 11,
    loggedOnYmd: '2026-08-27',
    loggedDays: [11],
  }) as { reason?: string }).reason,
  'taken',
);
ok('already-logged journey day cannot take a second Check');

const beforeSignup = openLogDays({
  epochYmd: '2026-08-26',
  todayYmd: '2026-08-27',
  loggedDays: [],
});
assert.deepEqual(
  beforeSignup.map((slot) => slot.ymd),
  ['2026-08-26', '2026-08-27'],
);
ok('window does not extend before signup');

const win = checkWindowFor(
  { created_at: '2026-08-26T00:15:56.857Z', timezone: 'America/Edmonton' },
  [],
  new Date('2026-08-27T18:00:00Z'),
);
assert.equal(win.epochYmd, '2026-08-25'); // 00:15 UTC Aug 26 = evening Aug 25 in Edmonton
assert.equal(win.todayYmd, '2026-08-27');
assert.equal(win.todayDay, 3);
ok('checkWindowFor uses the user timezone for epoch and today');

assert.equal(TEXT_KEEP_LOOKBACK_DAYS, 6);
assert.equal(textKeepStartYmd('2026-08-27'), '2026-08-21');
assert.equal(shouldKeepCheckText('2026-08-21', '2026-08-27'), true);
assert.equal(shouldKeepCheckText('2026-08-20', '2026-08-27'), false);
ok('Read/Do kept for rolling 7 days (today through today-6); older text drops');

const sundayMorning = new Date('2026-08-23T16:00:00Z');
const sundayWindow = recapWeekRange(sundayMorning, 'America/Edmonton');
assert.equal(sundayWindow.startYmd, '2026-08-16');
assert.equal(shouldKeepCheckText('2026-08-16', '2026-08-23'), false);
ok('flag: Sunday recap start (today-7) sits outside the 7-day text keep window');

const recap = checksInRecapWeek(
  [
    {
      created_at: '2026-08-27T18:00:00Z',
      logged_on: '2026-08-23',
      read_text: 'backdated Sunday',
    },
    {
      created_at: '2026-08-27T18:00:00Z',
      logged_on: '2026-08-26',
      read_text: 'Wednesday',
    },
  ],
  new Date('2026-08-27T18:00:00Z'),
  'America/Edmonton',
);
assert.equal(recap.length, 2);
assert.equal(recap[0].read_text, 'backdated Sunday');
ok('recap week uses logged_on, so a backdated Check sits on the day it is for');

const rolled = checksInRecapWeek(
  [
    {
      created_at: '2026-08-10T18:00:00Z',
      logged_on: '2026-08-10',
      read_text: null,
      do_text: null,
      status: 'done',
    } as { created_at: string; logged_on: string; read_text: string | null; do_text: string | null },
  ],
  new Date('2026-08-27T18:00:00Z'),
  'America/Edmonton',
);
assert.equal(rolled.length, 0);
ok('a day that rolled out of this week is not in the recap list (outcome still on the row)');

assert.equal(addDaysYmd('2026-08-25', -2), '2026-08-23');
ok('ymd lookback');

console.log(`\n${passed} checks passed`);
