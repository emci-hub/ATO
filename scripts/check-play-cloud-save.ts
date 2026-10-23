/**
 * Divecore foundations check (2026-10-15): the route stays on, cloud save, anonymous counters.
 * Run: npm run check:play-cloud-save
 *
 * - /play no longer redirects outside pre-launch builds; the layout-shot debug frames do.
 * - Cloud save restores ONLY when this phone has no Divecore save (the phone's own save wins),
 *   pushes the newest doc after a change, and never sends a doc over the server's 1 MB cap.
 * - Counters: each at most once per local day; a next-day open counts a return; the client's
 *   names match the server's fixed list (when wave96 is in the tree).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CLOUD_DOC_MAX_BYTES,
  EMPTY_COUNTERS,
  PLAY_COUNTERS,
  cloudPushAllowed,
  cloudRestoreStep,
  cloudSavePayload,
  localYmd,
  parseCounterState,
  planBump,
  planOpen,
  previousYmd,
  shouldRestoreFromCloud,
} from '../src/play/cloud-save-model';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

// --- restore rule ---------------------------------------------------------------------------
assert.equal(shouldRestoreFromCloud('{"version":33}', { version: 33 }), false, 'a phone with its own save never takes the server copy');
assert.equal(shouldRestoreFromCloud(null, { version: 33 }), true, 'a new phone restores');
assert.equal(shouldRestoreFromCloud('', { version: 33 }), true);
assert.equal(shouldRestoreFromCloud(null, null), false, 'nothing on the server: start fresh');
assert.equal(shouldRestoreFromCloud(null, [1, 2]), false);
ok('restore only when this phone has no Divecore save');

// --- the restore steps: only a definite answer turns pushes on --------------------------------
const base = { uid: 'A', checkedUid: null as string | null, hasLocal: false, provisional: false };
assert.deepEqual(cloudRestoreStep({ ...base, checkedUid: 'A' }, null), { done: true, restore: false, markChecked: false, markProvisional: false }, 'already checked: nothing to ask');
assert.deepEqual(cloudRestoreStep({ ...base, hasLocal: true }, null), { done: true, restore: false, markChecked: true, markProvisional: false }, 'a real save made on this phone is kept and starts pushing');
assert.equal(cloudRestoreStep(base, null).done, false, 'an empty phone asks the server');
assert.deepEqual(cloudRestoreStep(base, 'doc'), { done: true, restore: true, markChecked: true, markProvisional: false }, 'a save came back: restore it');
assert.deepEqual(cloudRestoreStep(base, 'none'), { done: true, restore: false, markChecked: true, markProvisional: false }, 'no save on the server: start fresh and push');
assert.deepEqual(cloudRestoreStep(base, 'unknown'), { done: true, restore: false, markChecked: false, markProvisional: true }, 'offline / timeout / newer version: a provisional pet, pushes stay off');
assert.equal(cloudRestoreStep({ ...base, hasLocal: true, provisional: true }, null).done, false, 'a provisional pet asks again on the next open');
assert.equal(cloudRestoreStep({ ...base, hasLocal: true, provisional: true }, 'doc').restore, true, 'and the real save replaces it when it comes back');
assert.equal(cloudRestoreStep({ ...base, checkedUid: 'B', hasLocal: true }, null).markChecked, true, 'another account on this phone is checked for itself');
ok('restore steps: only a definite answer turns pushes on; a fresh pet made offline never overwrites the real save');

assert.equal(cloudPushAllowed({ sessionUid: 'A', checkedUid: 'A', owner: 'A' }), true);
assert.equal(cloudPushAllowed({ sessionUid: null, checkedUid: 'A', owner: 'A' }), false, 'signed out');
assert.equal(cloudPushAllowed({ sessionUid: 'A', checkedUid: null, owner: 'A' }), false, 'not checked yet');
assert.equal(cloudPushAllowed({ sessionUid: 'B', checkedUid: 'B', owner: 'A' }), false, "A's pet never lands in B's row");
assert.equal(cloudPushAllowed({ sessionUid: 'A', checkedUid: 'A', owner: null }), false, 'queued before the check');
ok('push only for the checked account and a doc queued under it');

// --- push payload -----------------------------------------------------------------------------
const at = Date.UTC(2026, 9, 15, 12, 0, 0);
const p = cloudSavePayload({ version: 33 }, at);
assert.ok(p && p.p_version === 33 && p.p_saved_at === '2026-10-15T12:00:00.000Z', 'version + ISO saved_at');
assert.equal(cloudSavePayload({ version: 33 }, at, 'x'.repeat(CLOUD_DOC_MAX_BYTES + 1)), null, 'over 1 MB is not sent');
assert.ok(cloudSavePayload({ version: 33 }, at, 'é'.repeat(CLOUD_DOC_MAX_BYTES / 2)) != null, 'exactly 1 MB of 2-byte text is fine');
assert.equal(cloudSavePayload({ version: 33 }, at, 'é'.repeat(CLOUD_DOC_MAX_BYTES / 2 + 1)), null, 'counted in UTF-8 bytes, like the server');
ok('push payload: version, ISO time, 1 MB UTF-8 cap like the server');

// --- counters ---------------------------------------------------------------------------------
const day = new Date(2026, 9, 15, 9, 0, 0).getTime();
const ymd = localYmd(day);
let s = planBump(EMPTY_COUNTERS, 'rail_action', ymd);
assert.equal(s.send, true);
assert.equal(planBump(s.next, 'rail_action', ymd).send, false, 'once per day');
assert.equal(planBump(s.next, 'rail_action', localYmd(day + 86_400_000)).send, true, 'again the next day');
const first = planOpen(EMPTY_COUNTERS, day);
assert.deepEqual(first.send, ['play_open'], 'a first open: no return yet');
const nextDay = planOpen(first.next, day + 86_400_000);
assert.deepEqual(nextDay.send, ['play_open', 'return_next_day'], 'opening the next day counts a return');
assert.deepEqual(planOpen(nextDay.next, day + 86_400_000 + 3_600_000).send, [], 'a second open the same day sends nothing');
assert.deepEqual(planOpen(first.next, day + 3 * 86_400_000).send, ['play_open'], 'a gap of days is not a next-day return');
assert.equal(previousYmd(day), localYmd(day - 86_400_000));
assert.deepEqual(parseCounterState('nope'), EMPTY_COUNTERS);
assert.deepEqual(parseCounterState('{"ymd":"2026-10-15","sent":["rail_action","hack"],"lastOpenYmd":null}').sent, ['rail_action'], 'unknown names are dropped');
ok('counters: once per local day, next-day return, unknown names dropped');

const wave96 = 'supabase/migrations/wave96_play_saves.sql';
if (existsSync(resolve(root, wave96))) {
  const sql = read(wave96);
  const list = /p_name not in \(([\s\S]*?)\)/.exec(sql)?.[1] ?? '';
  const server = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(server, [...PLAY_COUNTERS].sort(), 'client and server counter lists match');
  ok('client counter names = the server list in wave96');
}

// --- wiring -----------------------------------------------------------------------------------
const shell = read('src/app/play.tsx');
assert.ok(!/Redirect/.test(shell), '/play no longer redirects outside pre-launch builds (Divecore stays on)');
assert.match(shell, /PRE_LAUNCH_DEV &&\s*\(shotParams\.shot === 'pet'/, 'the layout-shot debug frames stay pre-launch only');
assert.match(shell, /countPlayOpen\(\)/);
assert.match(shell, /if \(mode === 'pet'\) countOnce\('hideout_open'\)/);
assert.equal((shell.match(/countOnce\('dive_start'\)/g) ?? []).length, 2, 'both dive starts are counted');
const store = read('src/play/use-play-store.ts');
assert.ok(store.indexOf('restoreFromCloud()') > 0 && store.indexOf('restoreFromCloud()') < store.indexOf('loadPlayStore()'), 'restore runs before the first local load');
assert.equal((store.match(/queueCloudSave\(next\)/g) ?? []).length, 2, 'every local save also queues a cloud push');
const io = read('src/play/cloud-save.ts');
assert.match(io, /cloudRestoreStep\(/, 'the restore follows the pure steps');
assert.match(io, /withTimeout\(supabase\.from\('play_saves'\)/, 'the restore read gives up after a few seconds');
assert.match(io, /cloudPushAllowed\(/, 'pushes go through the owner check');
assert.match(io, /AppState\.addEventListener/, 'pushes when the app goes to the background');
assert.match(read('src/play/defend-screen.tsx'), /countOnce\('turf_wave_start'\)/);
assert.match(read('src/play/hideout-rails.tsx'), /countOnce\('rail_action'\)/);
ok('wiring: route on, debug frames gated, restore before load, push after every save, six counters hooked');

console.log(`\ncheck:play-cloud-save — ${passed} groups passed.`);
