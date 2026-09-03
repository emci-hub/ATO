/**
 * Hidden dev-access unlock (7-tap version number -> password -> Edge
 * Function). Run: npm run check:dev-unlock
 *
 * Static gate for the replacement to the old hardcoded dev-test sign-in:
 *   - the Edge Function never answers without a JWT, never succeeds against
 *     an empty/unset secret, and only ever returns a plain ok boolean
 *   - the client never hardcodes a password; the unlock is in-memory only
 *     (no AsyncStorage/SecureStore) so it cannot survive a cold start
 *   - the 7-tap gate renders unconditionally, not behind PRE_LAUNCH_DEV or
 *     __DEV__ — it is the only way in once PRE_LAUNCH_DEV is off
 *   - canSeeDevLab call sites (dev-lab.tsx, Home) accept the unlock alongside
 *     PRE_LAUNCH_DEV/__DEV__, root, and per-account grants
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

const fn = read('supabase/functions/dev-unlock/index.ts');
assert.match(fn, /if \(!authHeader\) return json\(\{ error: 'missing_authorization' \}, 401\)/);
assert.match(fn, /auth\.getUser\(\)/);
assert.match(fn, /if \(userError \|\| !user\) return json\(\{ error: 'not_authenticated' \}, 401\)/);
assert.match(fn, /Deno\.env\.get\('DEV_UNLOCK_PASSWORD'\)/);
assert.match(fn, /secret\.length > 0 && password\.length > 0/);
assert.doesNotMatch(fn, /DEV_UNLOCK_PASSWORD\s*=\s*['"]/);
ok('dev-unlock Edge Function requires a JWT and never unlocks on an empty/unset secret');

const store = read('src/lib/dev-access-unlock.ts');
assert.match(store, /export function isDevAccessUnlocked/);
assert.match(store, /export function setDevAccessUnlocked/);
assert.match(store, /export function useDevAccessUnlocked/);
assert.doesNotMatch(store, /from '@react-native-async-storage\/async-storage'|from 'expo-secure-store'/);
ok('dev unlock flag is a plain in-memory module singleton, never persisted');

const client = read('src/lib/dev-unlock-server.ts');
assert.match(client, /functions\.invoke\('dev-unlock'/);
assert.doesNotMatch(client, /password\s*[:=]\s*['"][^'"]+['"]/);
ok('client calls the Edge Function and never hardcodes a password to compare against');

const gate = read('src/components/dev-unlock-gate.tsx');
assert.match(gate, /const TAP_THRESHOLD = 7/);
assert.match(gate, /verifyDevUnlockPassword/);
assert.match(gate, /setDevAccessUnlocked\(true\)/);
assert.doesNotMatch(gate, /from '@\/lib\/dev-mode'/);
assert.doesNotMatch(gate, /if \(__DEV__\)|if \(!__DEV__\)/);
ok('7-tap gate is not itself gated behind PRE_LAUNCH_DEV or __DEV__');

const you = read('src/app/(tabs)/you.tsx');
assert.match(you, /AppVersionDevUnlock/);
ok('You screen renders the version-tap dev-unlock gate');

const hub = read('src/app/dev-lab.tsx');
assert.match(hub, /useDevAccessUnlocked/);
assert.match(hub, /PRE_LAUNCH_DEV \|\| devUnlocked/);
ok('Dev Tools Hub gate accepts the session unlock alongside PRE_LAUNCH_DEV');

const home = read('src/app/(tabs)/index.tsx');
assert.match(home, /useDevAccessUnlocked/);
assert.match(home, /__DEV__ \|\| devUnlocked/);
ok('Home dev row gate accepts the session unlock alongside __DEV__');

console.log(`\n${passed}/${passed} dev-unlock checks passed.`);
