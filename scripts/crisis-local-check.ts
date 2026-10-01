/**
 * On-device crisis signal. Run: npm run check:crisis-local
 *
 * The static crisis card on Home could never appear: nothing writes the server
 * table it read (Talk, its only writer, was removed). The local signal is the
 * replacement: typed text → the keyword check (no model) → today's date on this
 * phone → Home ORs it with the server's answer.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { keywordDetect } from '../src/lib/crisis/detect';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

// The detector itself: the dev test phrase flags; ordinary text does not.
assert.equal(keywordDetect('I want to kill myself'), true);
assert.equal(keywordDetect('Trains for a 10k on Sundays.'), false);
assert.equal(keywordDetect(''), false);
ok('keyword check flags the test phrase and leaves ordinary text alone');

const flag = read('src/lib/crisis/local-flag.ts');
assert.ok(flag.includes("export const CRISIS_LOCAL_KEY = 'ato.crisis.today.v1';"), 'under ato. so sign-out / delete wipe it');
assert.ok(flag.includes('if (!keywordDetect(text)) return false;'), 'only a keyword hit writes anything');
assert.ok(flag.includes('AsyncStorage.setItem(CRISIS_LOCAL_KEY, deviceYmd(now))'), 'stores the DATE only');
assert.equal(flag.split('AsyncStorage.setItem(').length - 1, 1, 'one write, and it is the date');
assert.doesNotMatch(flag, /supabase|generateText|fetch\(/, 'no network, no model');
ok('local flag: keyword hit → today’s date on this phone; the text is never stored or sent');

// Wired in: typed text is checked, and Home reads the flag.
const meSrc = read('src/lib/me.ts');
const addFact = meSrc.slice(meSrc.indexOf('export async function addFact'), meSrc.indexOf('export async function removeFact'));
assert.ok(
  addFact.includes("import('@/lib/crisis/local-flag').then((m) => m.noteCrisisText(trimmed))"),
  'a saved fact runs through the crisis check',
);
const home = read('src/app/(tabs)/index.tsx');
assert.ok(home.includes('setCrisisToday(next.crisisToday || crisisLocal);'), 'Home ORs the local flag with the server flag');
assert.ok(home.includes('const crisisLocal = await crisisNotedToday();'), 'the local flag is read before it is ORed');
assert.ok(home.includes('if (await crisisNotedToday()) setCrisisToday(true);'), 'and still shows it when the network fails');
assert.ok(home.includes('{crisisToday ? <CrisisCard /> : null}'), 'the card stays the static CrisisCard');
ok('wired: saved text is checked; Home shows the static card from either flag, even offline');

// A way to test it on a device without typing a real phrase into the app.
const hub = read('src/app/dev-lab.tsx');
assert.ok(hub.includes('{PRE_LAUNCH_DEV ? <CrisisLocalFlagTest /> : null}'), 'dev test is pre-launch only');
ok('dev test: flag / clear from the Dev Tools Hub');

console.log(`\n${passed} crisis-local checks passed`);
