/**
 * "Draft copy — waiting on emci review." badges must never reach a real user.
 * Run: npm run check:copy-review-badges
 *
 * Each *_COPY_REVIEWED flag stays `false` until emci reads the copy (see the
 * wave19-22 checks), but a `false` flag alone used to be enough to render the
 * badge for every OTA user, pre-launch or not. Every render site must also
 * require PRE_LAUNCH_DEV so the badge disappears the moment that flag flips
 * off for a public build, same as every other pre-launch convenience.
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

const BADGE = 'Draft copy — waiting on emci review.';

const sites = [
  'src/components/category-compare.tsx',
  'src/components/sage-title-card.tsx',
  'src/components/concept-hint.tsx',
  'src/components/full-profile-fold.tsx',
  'src/components/category-teaser.tsx',
  'src/components/categories-fold.tsx',
  'src/components/sage-story-fold.tsx',
  'src/components/intake-sweep.tsx',
  'src/components/profile-fill-fold.tsx',
];

for (const rel of sites) {
  const src = read(rel);
  assert.match(src, /import \{ PRE_LAUNCH_DEV \} from '@\/lib\/dev-mode';/, `${rel} must import PRE_LAUNCH_DEV`);
  const badgeIndex = src.indexOf(BADGE);
  assert.ok(badgeIndex >= 0, `${rel} no longer renders the badge text — update this check`);
  // The nearest `{...condition ? (` above the badge text is the render gate.
  const before = src.slice(0, badgeIndex);
  const gateStart = before.lastIndexOf('{');
  const gate = src.slice(gateStart, badgeIndex);
  assert.match(gate, /PRE_LAUNCH_DEV/, `${rel}'s badge condition must require PRE_LAUNCH_DEV: ${gate}`);
  ok(`${rel} gates the draft-copy badge behind PRE_LAUNCH_DEV`);
}

console.log(`\n${passed}/${passed} copy-review-badge checks passed.`);
