/**
 * Dev Lab screen sections. Run: npm run check:dev-lab-sections
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const hub = read('src/app/dev-lab.tsx');

const homeHeading = hub.indexOf('<ThemedText type="smallBold">Home</ThemedText>');
const sageHeading = hub.indexOf('<ThemedText type="smallBold">Sage</ThemedText>');
const youHeading = hub.indexOf('<ThemedText type="smallBold">You</ThemedText>');
const systemHeading = hub.indexOf('<ThemedText type="smallBold">System</ThemedText>');
assert.ok(homeHeading >= 0, 'Home heading');
assert.ok(sageHeading >= 0, 'Sage heading');
assert.ok(youHeading >= 0, 'You heading');
assert.ok(systemHeading >= 0, 'System heading');
assert.ok(
  homeHeading < sageHeading && sageHeading < youHeading && youHeading < systemHeading,
  'section order is Home, Sage, You, System',
);
ok('all four section headings exist');

const homeBlock = hub.slice(homeHeading, sageHeading);
const afterHome = hub.slice(sageHeading);
assert.match(homeBlock, /<HomeOverrides \/>/);
assert.match(homeBlock, /<CardSimulator \/>/);
assert.match(hub, /Today slot override/);
assert.match(hub, /Ask kind override/);
assert.match(hub, /Today slot inputs/);
assert.match(hub, /crisisActive:/);
assert.match(hub, /noteOpenedToday:/);
assert.match(hub, /resolveTodaySlot/);
assert.doesNotMatch(afterHome, /<HomeOverrides \/>/);
assert.doesNotMatch(hub, /label: 'Card'/);
assert.doesNotMatch(hub, /section === 'card'/);
ok('Today slot and Ask kind overrides render under Home, not a Card section');

assert.equal((hub.match(/<ForceTestError /g) ?? []).length, 4);
assert.match(hub, /Force test error/);
assert.match(hub, /Dev Lab test error — Home/);
assert.match(hub, /Dev Lab test error — Sage/);
assert.match(hub, /Dev Lab test error — You/);
assert.match(hub, /Dev Lab test error — System/);
ok('four Force test error triggers, one distinct message per section');

assert.match(
  hub,
  /!canSeeDevLab\(\{\s*isDev: __DEV__,\s*isRoot: devAccess\.isRoot,\s*capabilities: devAccess\.capabilities,\s*\}\)/,
);
assert.match(hub, /Redirect href="\/"/);
ok('existing access guard is unchanged');

console.log(`\nAll ${passed} dev-lab-sections checks passed.`);
