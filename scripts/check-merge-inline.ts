/**
 * check:merge-inline — guards the inline Merge redesign in Dress (2026-09-27).
 *
 * The old flow opened a detached confirm card (Cancel / Merge) above the Bag,
 * disconnected from the row that asked for it. Merge now lives on the item's
 * own row: two taps (arm, then roll — a miss permanently spends one fuel
 * copy), the odds always on the button, and the result played on the row that
 * actually changed. This check runs the pure rules in plain Node and refuses
 * the detached card structurally.
 *
 * Run: npx tsx scripts/check-merge-inline.ts
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import {
  MERGE_ARM_MS,
  MERGE_RESULT_MS,
  bagRowKey,
  mergeButtonA11y,
  mergeButtonLabel,
  mergeFeedbackLabel,
  mergeResultRowKey,
  wornRowKey,
} from '../src/play/merge-inline';

const repoRoot = path.resolve(__dirname, '..');
let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

/* --------------------------------------------------- 1 — the pure rules --- */

assert.equal(mergeButtonLabel('idle', 55), 'Merge · 55%');
assert.equal(mergeButtonLabel('armed', 55), 'Tap again · 55%');
assert.equal(mergeButtonLabel('rolling', 55), 'Rolling…');
ok('the button carries the odds when idle AND when armed, and says Rolling… mid-roll');

assert.match(mergeButtonA11y('armed', 'Ember Blade', 55), /Confirm merge Ember Blade, 55 percent/);
assert.match(mergeButtonA11y('armed', 'Ember Blade', 55), /spend/i);
ok('the armed state tells a screen-reader user it confirms, and what a miss costs');

assert.ok(MERGE_ARM_MS >= 2000 && MERGE_ARM_MS <= 6000, 'the arm lapses — long enough to tap, short enough to be safe');
assert.ok(MERGE_RESULT_MS >= 1000, 'the result stays on the row long enough to read');
ok(`an armed Merge lapses after ${MERGE_ARM_MS}ms; results stay ${MERGE_RESULT_MS}ms`);

assert.equal(bagRowKey('blade_ember_01', 2), 'bag:blade_ember_01@2');
assert.notEqual(bagRowKey('x', 1), bagRowKey('x', 2), 'two stars of one item are two rows');
ok('bag row keys are stable and distinguish star tiers');

// A worn slot's key follows the ITEM in it, so swapping the item drops an arm
// left on the old one (one tap must never roll an item nobody armed).
assert.notEqual(
  wornRowKey('weapon', 'blade_ember_01'),
  wornRowKey('weapon', 'blade_tide_01'),
  'a different item in the same slot is a different row — its arm does not carry over',
);
assert.equal(
  wornRowKey('weapon', 'blade_ember_01'),
  wornRowKey('weapon', 'blade_ember_01'),
  'the same item stays the same row across its own star upgrade (star is not in the key)',
);
ok('a worn row is keyed on slot + item, so swapping the item clears its arm');

// Where the result lands.
const bagTarget = { id: 'blade_ember_01', star: 2, main: 'bag' as const };
const wornTarget = { id: 'blade_ember_01', star: 2, main: 'worn' as const };
const tappedBag = bagRowKey('blade_ember_01', 2);
const tappedWorn = wornRowKey('weapon', 'blade_ember_01');
assert.equal(
  mergeResultRowKey(tappedBag, bagTarget, { success: true, pct: 55, fromStar: 2, toStar: 3 }),
  bagRowKey('blade_ember_01', 3),
  'a bag-main success shows on the NEXT star stack, where the new copy actually is',
);
assert.equal(
  mergeResultRowKey(tappedBag, bagTarget, { success: false, pct: 55, fromStar: 2 }),
  tappedBag,
  'a bag-main miss shows on the tapped stack',
);
assert.equal(
  mergeResultRowKey(tappedWorn, wornTarget, { success: true, pct: 55, fromStar: 2, toStar: 3 }),
  tappedWorn,
  'a worn-main success upgrades in place — same slot row',
);
ok('success and miss land on the row that actually changed');

assert.equal(mergeFeedbackLabel({ key: 'k', success: true, toStar: 3, seq: 1 }), '✓ Merged ★3');
assert.match(mergeFeedbackLabel({ key: 'k', success: false, toStar: null, seq: 1 }), /Missed.*spare spent/);
ok('on-row result text is plain: "✓ Merged ★3" / "✗ Missed · spare spent"');

/* ---------------------------------------- 2 — the detached card stays gone --- */

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const dress = strip(fs.readFileSync(path.join(repoRoot, 'src/play/dress-screen.tsx'), 'utf8'));
const row = strip(fs.readFileSync(path.join(repoRoot, 'src/play/merge-row.tsx'), 'utf8'));

assert.doesNotMatch(dress, /\bMergePanel\b/, 'the detached merge confirm card must not come back');
assert.doesNotMatch(dress, /label="Cancel"/, 'no Cancel button — confirming happens on the row (tap again)');
assert.doesNotMatch(dress, /\bmergeTarget\b/, 'no screen-level "pending merge" that opens a separate card');
ok('Dress has no detached confirm card, no Cancel, no pending-merge state');

assert.match(dress, /useInlineMerge\(/, 'Dress runs merges through the inline flow');
assert.match(dress, /<InlineMergeButton/, 'rows render their own Merge button');
assert.match(dress, /<MergeFeedbackRow/, 'rows play their own result feedback');
assert.match(dress, /<ItemDetails/, 'rows expand in place to show details');
ok('rows own their Merge button, their result feedback, and an in-place details panel');

assert.match(row, /armedKey !== key/, 'the first tap only arms');
assert.match(row, /MERGE_ARM_MS/, 'an armed button lapses on its own');
ok('Merge is two taps: the first arms, the second rolls');

assert.match(row, /if \(reduceMotion\)/, 'result feedback branches on reduce motion');
const reduceBranch = row.slice(row.indexOf('if (reduceMotion)'), row.indexOf('return;', row.indexOf('if (reduceMotion)')));
assert.doesNotMatch(reduceBranch, /shake/, 'reduce motion never shakes the row');
// Reanimated's default ReduceMotion.System SKIPS withDelay when the phone's
// reduce-motion setting is on — which collapsed the tint hold to one frame.
assert.match(
  reduceBranch,
  /ReduceMotion\.Never/,
  'the reduce-motion tint must opt out of ReduceMotion.System, or its hold collapses to one frame',
);
ok('reduce motion gets a flat tint that actually holds, and text — no shake');

console.log(`\nAll ${passed} merge-inline checks passed.`);
