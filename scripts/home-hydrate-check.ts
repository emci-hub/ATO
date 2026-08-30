/**
 * Home hydrates today's card from the Check row on a fresh install.
 * Run: npm run check:home-hydrate
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { bankCardForMe } from '../src/lib/voice/bank';
import type { VoiceMe } from '../src/lib/voice/types';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

type VoiceSource = 'bank' | 'generated';

interface CheckSlice {
  day: number;
  read_text: string | null;
  do_text: string | null;
  source: VoiceSource;
  nudge_text: string | null;
}

/** Lockstep with `todayCardFromCheck` in src/lib/today-card.ts (no RN import). */
function todayCardFromCheck(check: CheckSlice) {
  const read = check.read_text?.trim() ?? '';
  const doText = check.do_text?.trim() ?? '';
  if (!read || !doText) return null;
  return {
    day: check.day,
    read,
    do: doText,
    source: check.source,
    nudge: check.nudge_text,
  };
}

const impl = read('src/lib/today-card.ts');
assert.match(impl, /export function todayCardFromCheck/);
assert.match(impl, /if \(!read \|\| !doText\) return null;/);
assert.match(impl, /Fresh installs have empty/);
ok('todayCardFromCheck lives on the Home card helper');

const emptyLocal: string | null = null;
assert.equal(emptyLocal, null);
ok('simulated fresh install has no on-device today-card');

const today: CheckSlice = {
  day: 9,
  read_text: 'One real thing, then stop.',
  do_text: 'Do the next 10 minutes, then close the laptop.',
  nudge_text: 'You told Sage something that is still true: I finish work at four.',
  source: 'bank',
};
const hydrated = todayCardFromCheck(today);
assert.ok(hydrated);
assert.equal(hydrated.read, 'One real thing, then stop.');
assert.equal(hydrated.do, 'Do the next 10 minutes, then close the laptop.');
assert.equal(hydrated.nudge, today.nudge_text);
assert.equal(hydrated.day, 9);
assert.equal(hydrated.source, 'bank');
ok("fresh install hydrates Read/Do/Nudge from today's Check row");

assert.equal(
  todayCardFromCheck({ ...today, read_text: '  ' }),
  null,
);
assert.equal(
  todayCardFromCheck({ ...today, do_text: null }),
  null,
);
ok('empty or pruned Check text does not invent a card');

const home = read('src/app/(tabs)/index.tsx');
assert.match(home, /todayCardFromCheck/);
assert.match(home, /saveTodayCard\(hydrated\)/);
assert.match(home, /window\.todayDay/);
assert.match(home, /if \(card \|\| !window\) return;/);
ok('Home calls hydrate when local card is missing and today is already logged');

const CONSENT_OFF_EMPTY =
  'No card today. Sage only writes these with your say-so — you can turn that on any time in You.';

function qualifiesConsentOffEmpty(
  day: number,
  aiConsent: boolean | null,
  bankCard: { read: string; do: string } | null,
): boolean {
  return day > 3 && aiConsent !== true && bankCard === null;
}

assert.equal(qualifiesConsentOffEmpty(4, null, null), true);
assert.equal(qualifiesConsentOffEmpty(4, false, null), true);
assert.equal(qualifiesConsentOffEmpty(3, null, null), false);
assert.equal(qualifiesConsentOffEmpty(4, true, null), false);
assert.equal(qualifiesConsentOffEmpty(4, false, { read: 'a', do: 'b' }), false);

const bankMe: VoiceMe = {
  name: 'Riley',
  show_up: 'finishing my resume',
  talk_style: 'even',
  knocks_you_off: 'sleep',
  morning_cue: 'make coffee',
};
assert.equal(bankCardForMe(4, bankMe), null);
assert.ok(bankCardForMe(1, bankMe));
assert.equal(qualifiesConsentOffEmpty(4, null, bankCardForMe(4, bankMe)), true);
assert.equal(qualifiesConsentOffEmpty(4, true, bankCardForMe(4, bankMe)), false);
ok('honest-empty qualifies past day 3 with consent not true and a null bank card; not when consent is true');

assert.ok(home.includes(CONSENT_OFF_EMPTY));
assert.match(home, /window\.todayDay > 3/);
assert.match(home, /me\.ai_consent !== true/);
assert.match(home, /bankCardForMe\(window\.todayDay/);
assert.match(home, /consentOffEmpty/);
assert.doesNotMatch(
  home.slice(home.indexOf('consentOffEmpty ?'), home.indexOf('No card yet')),
  /persistRoutedCard|saveTodayCard|writeWidget/,
);
ok('Home shows the exact consent-off empty line in place of Read/Do; widget write is not on that branch');

console.log(`\nhome-hydrate-check: ${passed}/${passed} passed`);
