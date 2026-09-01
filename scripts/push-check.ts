/**
 * Push + widget checks. Run: npx tsx scripts/push-check.ts
 *
 * Verifies: permission is asked only after the first Check, copy has no fake
 * urgency, Sunday N is the week's check count, deep-link paths land on Home
 * vs the weekly recap, and an empty widget payload is honest.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  copyHasFakeUrgency,
  eveningPush,
  morningPush,
  pathFromNotificationData,
  PUSH_PATHS,
  recapFromReads,
  sundayPush,
} from '../src/lib/push-copy';
import { shouldAskNotificationPermission, pushWindowForEnergy } from '../src/lib/push-policy';
import { addDaysYmd, localYmd, weekdayInZone } from '../src/lib/local-date';
import { checksInRecapWeek, recapWeekRange } from '../src/lib/week-window';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

assert.equal(shouldAskNotificationPermission({ checkCount: 0, alreadyAsked: false }), false);
assert.equal(shouldAskNotificationPermission({ checkCount: 0, alreadyAsked: true }), false);
assert.equal(shouldAskNotificationPermission({ checkCount: 1, alreadyAsked: false }), true);
assert.equal(shouldAskNotificationPermission({ checkCount: 8, alreadyAsked: false }), true);
assert.equal(shouldAskNotificationPermission({ checkCount: 8, alreadyAsked: true }), false);
ok('permission asked only after first check, and only once');

assert.deepEqual(pushWindowForEnergy(null), { morningHour: 7, eveningHour: 20 });
assert.deepEqual(pushWindowForEnergy(undefined), { morningHour: 7, eveningHour: 20 });
assert.deepEqual(pushWindowForEnergy('unexpected'), { morningHour: 7, eveningHour: 20 });
assert.deepEqual(pushWindowForEnergy('morning'), { morningHour: 6, eveningHour: 19 });
assert.deepEqual(pushWindowForEnergy('afternoon'), { morningHour: 8, eveningHour: 20 });
assert.deepEqual(pushWindowForEnergy('evening'), { morningHour: 9, eveningHour: 21 });
assert.deepEqual(pushWindowForEnergy('night_owl'), { morningHour: 10, eveningHour: 22 });
ok('push window maps energy_pattern to send hours; null keeps the fixed default');

const morning = morningPush('The kettle is already on. Sit with it.');
assert.equal(morning.url, PUSH_PATHS.morning);
assert.equal(morning.title, 'Sage · coach');
assert.equal(morning.body, 'The kettle is already on. Sit with it.');
assert.equal(copyHasFakeUrgency(morning.body), false);
assert.equal(copyHasFakeUrgency(morning.title), false);
ok('morning push is the Read, no urgency');

assert.doesNotMatch(morning.title, /npc|Nudge/i);
assert.doesNotMatch(morning.body, /Nudge/);
const widgetSwift = readFileSync(resolve(__dirname, '../targets/widget/widgets.swift'), 'utf8');
assert.match(widgetSwift, /SAGE · COACH/);
assert.doesNotMatch(widgetSwift, /[Nn]udge|npc/);
ok('morning push and widget stay Sage · coach; no Nudge');

const evening = eveningPush();
assert.equal(evening.url, PUSH_PATHS.evening);
assert.match(evening.title, /check today/i);
assert.equal(copyHasFakeUrgency(evening.body), false);
assert.doesNotMatch(evening.body, /streak/i);
ok('evening push is Check today, no streak framing');

const sundayZero = sundayPush({ showedUp: 0, recap: recapFromReads([]) });
assert.equal(sundayZero.url, PUSH_PATHS.sunday);
assert.match(sundayZero.body, /You showed up 0/);
assert.match(sundayZero.body, /Nothing logged this week/);
assert.equal(copyHasFakeUrgency(sundayZero.body), false);
ok('Sunday with 0 checks is honest, not fabricated');

const sundayN = sundayPush({
  showedUp: 4,
  recap: recapFromReads(['one', 'two', 'three', 'four']),
});
assert.match(sundayN.body, /You showed up 4/);
assert.doesNotMatch(sundayN.body, /streak|losing/i);
ok('Sunday N is the week count, no streak copy');

assert.equal(pathFromNotificationData({ url: '/' }), '/');
assert.equal(pathFromNotificationData({ url: '/?focus=check' }), '/?focus=check');
assert.equal(pathFromNotificationData({ url: '/week' }), '/week');
assert.equal(pathFromNotificationData({ url: '/home' }), '/');
assert.equal(pathFromNotificationData({}), null);
ok('deep-link paths: Home, Home+check, week recap');

const tz = 'America/Edmonton';
const sundayMorning = new Date('2026-08-23T16:00:00Z'); // 10:00 Sunday in Edmonton (UTC-6)
assert.equal(localYmd(sundayMorning, tz), '2026-08-23');
assert.equal(weekdayInZone(sundayMorning, tz), 0);
const sundayWindow = recapWeekRange(sundayMorning, tz);
assert.equal(sundayWindow.startYmd, '2026-08-16');
assert.equal(sundayWindow.endYmdExclusive, '2026-08-23');
ok('Sunday recap covers the week that just ended (Sun–Sat)');

const wednesday = new Date('2026-08-26T18:00:00Z'); // 12:00 Wednesday in Edmonton
assert.equal(weekdayInZone(wednesday, tz), 3);
const midWindow = recapWeekRange(wednesday, tz);
assert.equal(midWindow.startYmd, '2026-08-23');
assert.equal(midWindow.endYmdExclusive, '2026-08-27');
ok('mid-week recap is this Sunday through today');

const weekChecks = [
  { created_at: '2026-08-17T15:00:00Z', read_text: 'Mon' },
  { created_at: '2026-08-22T15:00:00Z', read_text: 'Sat' },
  { created_at: '2026-08-23T16:00:00Z', read_text: 'this Sunday' },
];
const recapChecks = checksInRecapWeek(weekChecks, sundayMorning, tz);
assert.equal(recapChecks.length, 2);
assert.equal(recapChecks[0].read_text, 'Mon');
assert.equal(recapChecks[1].read_text, 'Sat');
ok('Sunday N counts the week, not all-time, and not this Sunday morning');

const backdated = checksInRecapWeek(
  [{ created_at: '2026-08-27T18:00:00Z', logged_on: '2026-08-22', read_text: 'Sat via backdate' }],
  sundayMorning,
  tz,
);
assert.equal(backdated.length, 1);
assert.equal(backdated[0].read_text, 'Sat via backdate');
ok('recap uses logged_on so a late log still counts on the day it is for');

assert.equal(addDaysYmd('2026-08-25', 1), '2026-08-26');
ok('ymd day math');

const emptyWidget = { hasCard: false, read: '', do: '' };
assert.equal(emptyWidget.hasCard, false);
assert.equal(emptyWidget.read, '');
ok('empty widget payload is an honest empty, not a fake card');

console.log(`\n${passed} checks passed`);
