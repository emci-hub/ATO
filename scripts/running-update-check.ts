/**
 * Build/OTA glance line. Run: npm run check:running-update
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  formatPublishedAt,
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
  createdAt: null,
};

// Fixed instant. `formatPublishedAt` is deliberately device-local (no timeZone
// param, unlike `formatTraitTouchedAt`), so its exact clock-hour output shifts
// with the machine running this check — assert shape, not an exact string.
const TEST_PUBLISHED_AT = new Date('2026-09-03T18:42:00.000Z');
const PUBLISHED_AT_SHAPE = /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s?(AM|PM)$/;

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

assert.equal(formatPublishedAt(null), null);
assert.equal(formatPublishedAt(new Date('not-a-date')), null);
assert.match(formatPublishedAt(TEST_PUBLISHED_AT)!, PUBLISHED_AT_SHAPE);
ok('publish date is null when unknown/invalid, otherwise a "Mon D, YYYY, H:MM AM/PM"-shaped string');

// The publish date is its own line in the component (never appended to
// `.line`, which stays exactly as tested above — a real device line is
// already close to the row's width, and the row has no wrap guard). The
// component decides whether to show it by `label.kind`, same honesty rule as
// the line itself: only `group`/`update` have a real publish date.
const groupLabel = formatRunningUpdate({
  ...empty,
  enabled: true,
  groupId: '9bc83409-078c-4e03-a556-a74af0692286',
  channel: 'production',
  runtimeVersion: '1.0.0',
  createdAt: TEST_PUBLISHED_AT,
});
assert.equal(groupLabel.line, 'group · 9bc83409 · production · 1.0.0');
assert.equal(groupLabel.kind, 'group');
const embeddedLabel = formatRunningUpdate({
  ...empty,
  isEmbedded: true,
  runtimeVersion: '1.0.0',
  createdAt: TEST_PUBLISHED_AT,
});
assert.equal(embeddedLabel.line, 'embedded · 1.0.0');
assert.equal(embeddedLabel.kind, 'embedded');
ok('formatRunningUpdate().line never carries the publish date; .kind tells the component when a real one exists');

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
assert.match(line, /Updates\.createdAt/);
assert.match(line, /formatPublishedAt/);
assert.match(line, /\/ai-lab/);
ok('You Settings and Dev Tools Hub both show the running-update line');

console.log(`\n${passed} running-update checks passed`);
