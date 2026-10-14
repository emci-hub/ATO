/**
 * "Did it ✓" streak + stored payload. Pure — no AsyncStorage.
 * Run: npm run check:daily-insights-streak
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  STREAK_DATES_CAP,
  currentStreak,
  emptyStore,
  emptyStreak,
  isDoneToday,
  markDone,
  parseStore,
} from '../src/lib/daily-insights';
import { addDaysYmd, localYmd } from '../src/lib/local-date';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:daily-insights-streak'], 'tsx ./scripts/daily-insights-streak-check.ts');
ok('wired as check:daily-insights-streak');

// Same day twice.
let s = markDone(emptyStreak(), '2026-10-13');
const again = markDone(s, '2026-10-13');
assert.equal(again, s);
assert.equal(s.current, 1);
assert.equal(s.doneDates.length, 1);
assert.equal(isDoneToday(s, '2026-10-13'), true);
ok('same-day tap is idempotent');

// Consecutive days.
s = markDone(s, '2026-10-14');
s = markDone(s, '2026-10-15');
assert.equal(s.current, 3);
assert.equal(s.best, 3);
assert.equal(currentStreak(s, '2026-10-15'), 3);
assert.equal(currentStreak(s, '2026-10-16'), 3, 'survives until the end of the next day');
assert.equal(currentStreak(s, '2026-10-17'), 0, 'reads 0 after a missed day');
ok('consecutive days count up; streak shows 0 after a missed day');

// Gap reset, best kept.
s = markDone(s, '2026-10-18');
assert.equal(s.current, 1);
assert.equal(s.best, 3);
ok('a gap resets to 1, best stays');

// Month and year boundaries.
let m = markDone(emptyStreak(), '2026-10-31');
m = markDone(m, '2026-11-01');
assert.equal(m.current, 2);
let y = markDone(emptyStreak(), '2026-12-31');
y = markDone(y, '2027-01-01');
assert.equal(y.current, 2);
assert.equal(currentStreak(y, '2027-01-02'), 2);
ok('month boundary (Oct 31 → Nov 1) and year boundary (2026-12-31 → 2027-01-01)');

// Cap at 60.
let long = emptyStreak();
let day = '2026-01-01';
for (let i = 0; i < 90; i += 1) {
  long = markDone(long, day);
  day = addDaysYmd(day, 1);
}
assert.equal(long.doneDates.length, STREAK_DATES_CAP);
assert.equal(long.current, 90);
assert.equal(long.best, 90);
assert.equal(long.doneDates[0], addDaysYmd('2026-01-01', 30));
ok('keeps at most 60 dates; the count itself is not capped');

// Future lastDone (timezone moved back).
const future = markDone(emptyStreak(), '2026-10-14');
const back = markDone(future, '2026-10-13');
assert.equal(back, future, 'no double count');
assert.equal(back.current, 1);
assert.equal(currentStreak(future, '2026-10-13'), 1, 'no negative gap');
assert.equal(isDoneToday(future, '2026-10-13'), true, 'future lastDone counts as today');
ok('lastDone in the future: treated as today, no double count, no crash');

// Timezone moved forward a day: normal rules.
const fwd = markDone(markDone(emptyStreak(), '2026-10-13'), '2026-10-15');
assert.equal(fwd.current, 1);
ok('timezone jump forward: a skipped day resets under normal rules');

// DST weekend (2026-11-01, America/Edmonton falls back).
{
  const instants = ['2026-10-31T18:00:00Z', '2026-11-01T18:00:00Z', '2026-11-02T18:00:00Z'];
  const keys = instants.map((iso) => localYmd(new Date(iso), 'America/Edmonton'));
  assert.deepEqual(keys, ['2026-10-31', '2026-11-01', '2026-11-02']);
  let dst = emptyStreak();
  for (const key of keys) dst = markDone(dst, key);
  assert.equal(dst.current, 3);
  // 00:30 local on Nov 1 and 23:30 local on Nov 1 are the same app day.
  assert.equal(localYmd(new Date('2026-11-01T06:30:00Z'), 'America/Edmonton'), '2026-11-01');
  assert.equal(localYmd(new Date('2026-11-02T06:30:00Z'), 'America/Edmonton'), '2026-11-01');
  ok('DST weekend in Edmonton: 3 days, the 25-hour day is still one day');
}

// Stored payload: corrupt, wrong version, wrong user.
assert.deepEqual(parseStore('{not json', 'u1'), emptyStore('u1'));
assert.deepEqual(parseStore(null, 'u1'), emptyStore('u1'));
assert.deepEqual(parseStore(JSON.stringify({ version: 2, userId: 'u1' }), 'u1'), emptyStore('u1'));
assert.deepEqual(parseStore('"just a string"', 'u1'), emptyStore('u1'));
assert.deepEqual(parseStore('null', 'u1'), emptyStore('u1'));
const otherUser = { ...emptyStore('u2'), streak: markDone(emptyStreak(), '2026-10-13') };
assert.deepEqual(parseStore(JSON.stringify(otherUser), 'u1'), emptyStore('u1'));
const mine = {
  ...emptyStore('u1'),
  streak: { version: 1, doneDates: ['2026-10-13', 'junk'], current: 1, best: 4, lastDone: '2026-10-13' },
  history: [{ dateKey: '2026-10-13', id: 'cat_drive.high.stretch' }, { bad: true }],
  picks: { '2026-10-13': 'cat_drive.high.stretch', nope: 3 },
};
const read = parseStore(JSON.stringify(mine), 'u1');
assert.deepEqual(read.streak.doneDates, ['2026-10-13']);
assert.equal(read.streak.best, 4);
assert.equal(read.history.length, 1);
assert.deepEqual(read.picks, { '2026-10-13': 'cat_drive.high.stretch' });
const badStreak = parseStore(JSON.stringify({ ...emptyStore('u1'), streak: { version: 9 } }), 'u1');
assert.deepEqual(badStreak.streak, emptyStreak());
ok('corrupt / unknown version / other account → fresh; junk rows dropped; never throws');

// The key is account-scoped and wiped by the deny-by-default clear.
const store = readFileSync(resolve(root, 'src/lib/daily-insights/store.ts'), 'utf8');
assert.match(store, /DAILY_INSIGHTS_STATE_KEY = 'ato\.daily-insights\.v1'/);
assert.match(store, /inQueue\(/);
const local = readFileSync(resolve(root, 'src/lib/local-account-data.ts'), 'utf8');
assert.ok(!local.includes('ato.daily-insights'), 'not on the keep list');
ok("key ato.daily-insights.v1, writes queued, not on clearLocalAccountData's keep list");

console.log(`\n${passed} daily-insights-streak checks passed`);
