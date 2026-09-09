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

// The You tab renders the Build line for every account, and 5 taps on it push
// /ai-lab (the AI provider switcher). Both the gesture and the route must carry
// the dev gate — /ai-lab was the one lab on the authed stack with no guard at
// all, and unlike the PRE_LAUNCH_DEV labs that hole would have survived the
// flag flip into public launch.
const runningUpdate = readFileSync(join(root, 'src/components/running-update-line.tsx'), 'utf8');
assert.match(runningUpdate, /canSeeDevLab\(\{/);
assert.match(runningUpdate, /if \(canOpenAiLab\) router\.push\('\/ai-lab'\)/);
ok('Build-line 5-tap shortcut to /ai-lab is gated on canSeeDevLab');

const aiLab = readFileSync(join(root, 'src/app/ai-lab.tsx'), 'utf8');
assert.match(aiLab, /canSeeDevLab\(\{/);
assert.match(aiLab, /return <Redirect href="\/" \/>;/);
ok('/ai-lab redirects anyone without dev access');

const metro = readFileSync(join(root, 'metro.config.js'), 'utf8');
assert.doesNotMatch(metro, /resolveRequest/);
assert.doesNotMatch(metro, /dev-probes-stub/);
ok('Metro is not stubbing the probe modules — they ship in production (pre-launch)');

console.log(`\nprod-you-check: ${passed}/${passed} passed`);
