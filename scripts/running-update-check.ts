/**
 * Build/OTA glance line. Run: npm run check:running-update
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  formatRunningUpdate,
  groupIdFromManifest,
  shortId,
  type RunningUpdateSnapshot,
} from '../src/lib/running-update';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

const empty: RunningUpdateSnapshot = {
  enabled: false,
  isEmbedded: false,
  updateId: null,
  groupId: null,
  channel: null,
  runtimeVersion: null,
};

assert.equal(shortId('9bc83409-078c-4e03-a556-a74af0692286'), '9bc83409');
assert.equal(
  formatRunningUpdate({
    ...empty,
    enabled: true,
    groupId: '9bc83409-078c-4e03-a556-a74af0692286',
    updateId: '01a0488c-bf30-7856-8331-0eb8d7e59394',
    channel: 'production',
    runtimeVersion: '1.0.0',
  }).line,
  'group · 9bc83409 · production · 1.0.0',
);
ok('prefers EAS group id over the per-platform update UUID');

assert.equal(
  formatRunningUpdate({
    ...empty,
    enabled: true,
    isEmbedded: false,
    updateId: '01a0488c-bf30-7856-8331-0eb8d7e59394',
    channel: 'production',
    runtimeVersion: '1.0.0',
  }).line,
  'update · 01a0488c · production · 1.0.0',
);
ok('falls back to short update UUID when group is missing');

assert.equal(formatRunningUpdate({ ...empty, isEmbedded: true, runtimeVersion: '1.0.0' }).line, 'embedded · 1.0.0');
assert.equal(formatRunningUpdate(empty).line, 'local · expo-updates off');
ok('embedded and local are honest instead of a fake hash');

assert.equal(
  groupIdFromManifest({
    metadata: { updateGroup: '9bc83409-078c-4e03-a556-a74af0692286' },
  }),
  '9bc83409-078c-4e03-a556-a74af0692286',
);
assert.equal(groupIdFromManifest({ extra: { eas: { group: 'abc' } } }), 'abc');
assert.equal(groupIdFromManifest({}), null);
ok('reads group from manifest metadata or extra.eas');

const you = read('src/app/(tabs)/you.tsx');
const hub = read('src/app/dev-lab.tsx');
const line = read('src/components/running-update-line.tsx');
assert.match(you, /RunningUpdateLine/);
assert.match(hub, /RunningUpdateLine/);
assert.match(line, /expo-updates/);
assert.match(line, /Updates\.updateId/);
assert.match(line, /Updates\.manifest/);
assert.match(line, /\/ai-lab/);
ok('You Settings and Dev Tools Hub both show the running-update line');

console.log(`\n${passed} running-update checks passed`);
