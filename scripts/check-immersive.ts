/**
 * Immersive mode check — the reference count behind `useImmersiveMode` /
 * `ImmersiveScreen` (src/lib/immersive.ts).
 *
 * Pins the rules that keep system bars from flickering back under a screen
 * that still wants fullscreen: hide on the first hold, restore only on the
 * last release, double releases are harmless, and `reapply` re-asserts the
 * current state (used when the app returns to the foreground).
 *
 * Run: npm run check:immersive
 */
import assert from 'node:assert/strict';

import { createImmersiveCounter } from '../src/lib/immersive';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const calls: boolean[] = [];
const counter = createImmersiveCounter((hidden) => calls.push(hidden));

const releaseA = counter.acquire();
assert.deepEqual(calls, [true], 'the first hold hides the bars');
const releaseB = counter.acquire();
assert.deepEqual(calls, [true], 'a second hold does not re-apply');
assert.equal(counter.count(), 2);
ok('the first hold hides the bars; later holds do nothing extra');

releaseA();
assert.deepEqual(calls, [true], 'bars stay hidden while another holder remains');
releaseA();
assert.equal(counter.count(), 1, 'a double release is ignored');
ok('releasing one of two holders keeps the bars hidden; double release is harmless');

releaseB();
assert.deepEqual(calls, [true, false], 'the last release restores the bars');
assert.equal(counter.count(), 0);
releaseB();
assert.deepEqual(calls, [true, false], 'and a repeat release never restores twice');
ok('the last release restores the bars exactly once');

counter.reapply();
assert.deepEqual(calls, [true, false, false], 'reapply with no holders keeps them shown');
const releaseC = counter.acquire();
counter.reapply();
assert.deepEqual(calls.slice(-2), [true, true], 'reapply re-hides while held (app resume)');
releaseC();
ok('reapply re-asserts the current state (used on app resume)');

console.log(`\nAll ${passed} immersive checks passed.`);
