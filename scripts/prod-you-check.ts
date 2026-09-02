/**
 * Pre-launch: the production bundle MUST ship the You-tab crash/push probes so
 * they work over OTA. Asserts the probe modules are wired through the
 * PRE_LAUNCH_DEV flag and that Metro is NOT stubbing them out of production.
 *
 * Before signup_mode goes public, invert this check (probes must NOT ship) and
 * re-add the Metro production probe stub — see PROJECT_CONTEXT.md "Pre-launch
 * re-gating checklist".
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const you = readFileSync(join(root, 'src/app/(tabs)/you.tsx'), 'utf8');
assert.doesNotMatch(you, /from '@\/components\/sentry-test-card'/);
assert.doesNotMatch(you, /from '@\/components\/push-test-card'/);
assert.match(you, /if \(PRE_LAUNCH_DEV\) \{/);
assert.match(you, /require\('@\/components\/you-dev-tools'\)/);
ok('You tab loads crash/push probes via a PRE_LAUNCH_DEV-gated dynamic require');

const metro = readFileSync(join(root, 'metro.config.js'), 'utf8');
assert.doesNotMatch(metro, /resolveRequest/);
assert.doesNotMatch(metro, /dev-probes-stub/);
ok('Metro is not stubbing the probe modules — they ship in production (pre-launch)');

console.log(`\nprod-you-check: ${passed}/${passed} passed`);
