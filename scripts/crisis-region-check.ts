/**
 * Crisis-card region detection and copy. Run: npm run check:crisis-region
 *
 * Confirmed numbers: US and Canada only (988). Any other locale must get the
 * honest fallback — never a guessed hotline.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CRISIS_FALLBACK,
  CRISIS_SERVICE_CA,
  CRISIS_SERVICE_US,
  crisisCardContent,
} from '../src/lib/crisis/copy';
import {
  detectCrisisRegion,
  resolveCrisisRegion,
  type DeviceRegionHints,
} from '../src/lib/crisis/region';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function detect(hints: DeviceRegionHints) {
  return detectCrisisRegion(hints);
}

function labelsOf(region: ReturnType<typeof detectCrisisRegion>) {
  return crisisCardContent(region)
    .actions.map((a) => a.label)
    .join('\n');
}

assert.equal(detect({ regionCode: 'US' }), 'US');
assert.match(labelsOf('US'), /988 Suicide & Crisis Lifeline/);
assert.match(labelsOf('US'), /Call 988/);
assert.match(labelsOf('US'), /Text 988/);
assert.equal(crisisCardContent('US').fallback, null);
assert.equal(CRISIS_SERVICE_US, '988 Suicide & Crisis Lifeline');
ok('US locale shows the US 988 label, call or text 988');

assert.equal(detect({ regionCode: 'CA' }), 'CA');
assert.match(labelsOf('CA'), /988 Suicide Crisis Helpline/);
assert.match(labelsOf('CA'), /Call 988/);
assert.match(labelsOf('CA'), /Text 988/);
assert.equal(crisisCardContent('CA').fallback, null);
assert.equal(CRISIS_SERVICE_CA, '988 Suicide Crisis Helpline');
ok('Canada locale shows the Canada 988 label, call or text 988');

assert.equal(detect({ regionCode: 'GB' }), 'other');
assert.equal(detect({ regionCode: 'GB', languageRegionCode: 'US' }), 'other');
assert.equal(
  detect({ regionCode: 'GB', timeZone: 'America/New_York' }),
  'other',
  'an explicit other country must not fall through to a US timezone',
);
assert.equal(detect({ languageRegionCode: 'GB' }), 'other');
assert.equal(detect({ regionCode: 'en-GB' }), 'other');
const uk = crisisCardContent('other');
assert.equal(uk.actions.length, 0);
assert.equal(uk.fallback, CRISIS_FALLBACK);
assert.equal(
  CRISIS_FALLBACK,
  "We don't have a local crisis line confirmed for your region yet. If you're in immediate danger, contact local emergency services.",
);
assert.doesNotMatch(uk.fallback ?? '', /988/);
assert.doesNotMatch(JSON.stringify(uk.actions), /988/);
ok('unsupported locale (UK) shows the honest fallback, not a number');

assert.equal(detect({ regionCode: 'PR' }), 'US');
assert.equal(detect({ regionCode: 'fr-CA' }), 'CA');
assert.equal(detect({ languageRegionCode: 'CA', regionCode: null }), 'CA');
ok('US territories and language-region CA still resolve to confirmed regions');

assert.equal(detect({ timeZone: 'America/New_York' }), 'US');
assert.equal(detect({ timeZone: 'America/Toronto' }), 'CA');
assert.equal(detect({ timeZone: 'America/Vancouver' }), 'CA');
assert.equal(detect({ timeZone: 'Europe/London' }), 'other');
assert.equal(detect({ timeZone: 'America/Mexico_City' }), 'other');
assert.equal(detect({ timeZone: 'GMT-05:00' }), 'other');
assert.equal(detect({}), 'other');
ok('timezone-only detection allowlists US/CA and fails closed otherwise');

assert.equal(resolveCrisisRegion('other', 'US'), 'US');
assert.equal(resolveCrisisRegion('US', 'CA'), 'CA');
assert.equal(resolveCrisisRegion('US', 'other'), 'other');
assert.equal(resolveCrisisRegion('CA', null), 'CA');
assert.match(labelsOf(resolveCrisisRegion('other', 'US')), /988 Suicide & Crisis Lifeline/);
assert.equal(crisisCardContent(resolveCrisisRegion('US', 'other')).actions.length, 0);
assert.equal(
  crisisCardContent(resolveCrisisRegion('US', 'other')).fallback,
  CRISIS_FALLBACK,
);
ok('Settings override wins over auto-detect, including forcing the fallback');

const root = path.resolve(__dirname, '..');
const copy = fs.readFileSync(path.join(root, 'src/lib/crisis/copy.ts'), 'utf8');
const region = fs.readFileSync(path.join(root, 'src/lib/crisis/region.ts'), 'utf8');
const card = fs.readFileSync(path.join(root, 'src/components/crisis-card.tsx'), 'utf8');
const you = fs.readFileSync(path.join(root, 'src/app/(tabs)/you.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/_layout.tsx'), 'utf8');
const picker = fs.readFileSync(
  path.join(root, 'src/components/crisis-region-picker.tsx'),
  'utf8',
);

assert.match(card, /crisisCardContent/);
assert.match(card, /useCrisisRegion/);
assert.match(layout, /CrisisRegionProvider/);
assert.match(you, /CrisisRegionPicker/);
assert.match(picker, /United States/);
assert.match(picker, /Canada/);
assert.match(picker, /Other region/);
assert.match(picker, /value: 'auto'/);
ok('card, launch provider, and visible Settings picker are wired');

const invented = /116\s*123|Samaritans|13\s*11\s*14|0800\s*689|IASP|befrienders/i;
assert.doesNotMatch(copy, invented);
assert.doesNotMatch(region, invented);
assert.doesNotMatch(card, invented);
ok('no invented hotlines for unconfirmed countries');

console.log(`\ncrisis-region-check: ${passed}/${passed} passed`);
