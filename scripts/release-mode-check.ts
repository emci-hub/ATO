/**
 * check:release-mode — refuses a PRODUCTION build while PRE_LAUNCH_DEV is on.
 *
 * PRE_LAUNCH_DEV (src/lib/dev-mode.ts) deliberately un-gates dev/testing
 * conveniences so they work over OTA while the app is invite-only. Before a
 * public release it must be `false`. This is the one automated assertion that
 * replaces the 11-item manual "Pre-launch re-gating checklist".
 *
 * When it enforces:
 *   - EAS production builds: wired via the `eas-build-post-install` hook in
 *     package.json (EAS sets EAS_BUILD_PROFILE). Non-production profiles skip.
 *   - Manually: RELEASE_MODE=1 npm run check:release-mode
 *
 * Otherwise (local dev, the OTA gate) it only verifies the flag still exists
 * and prints its value, so it stays green in check:ota-gate today.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const devMode = readFileSync(resolve(__dirname, '../src/lib/dev-mode.ts'), 'utf8');
const match = devMode.match(/export const PRE_LAUNCH_DEV\s*=\s*(true|false)\s*;/);
assert.ok(match, 'PRE_LAUNCH_DEV must be a literal true/false in src/lib/dev-mode.ts');
const value = match[1] === 'true';

const profile = process.env.EAS_BUILD_PROFILE ?? '';
const enforce = profile === 'production' || process.env.RELEASE_MODE === '1';

if (!enforce) {
  console.log(
    `release-mode: PRE_LAUNCH_DEV = ${value} (not enforced — profile "${profile || 'none'}", RELEASE_MODE unset)`,
  );
  console.log('\n1 release-mode check passed');
  process.exit(0);
}

if (value) {
  console.error(
    'release-mode: FAIL — PRE_LAUNCH_DEV is true in src/lib/dev-mode.ts.\n' +
      'A production build would ship the dev labs, Home dev links, You-tab probes, ' +
      'Legends test-persona strip and Home slot/ask overrides to every user.\n' +
      'Set PRE_LAUNCH_DEV = false (see PROJECT_CONTEXT.md "Pre-launch re-gating checklist").',
  );
  process.exit(1);
}

console.log('release-mode: PRE_LAUNCH_DEV = false — production build allowed.');
console.log('\n1 release-mode check passed');
