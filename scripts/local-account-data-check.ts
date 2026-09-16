/**
 * Local account data — the device-side half of account deletion.
 *
 * Why this file exists: on 2026-09-15 a deleted-then-recreated account on the
 * same device inherited the previous account's content. The server was never at
 * fault (a live orphan scan over every user-keyed column found zero rows, and
 * every `account_deletions` row reports rows_remaining = 0) — `deleteAccount`
 * simply cleared the auth session and nothing else, so every other `ato.*` key
 * survived and the next signup read it straight back.
 *
 * The load-bearing assertion here is DENY BY DEFAULT. `isAccountScopedKey` must
 * keep returning true for anything under the `ato.` namespace that is not on an
 * explicit keep-list. If it is ever inverted into an allow-list of keys to
 * erase, a key added later silently survives account deletion and the bug comes
 * back — quietly, and only on a device that has had two accounts on it, which
 * is exactly the case nobody tests.
 *
 * Source-text assertions, same convention as the other offline checks: this
 * module imports AsyncStorage and the Apple targets bridge, so importing it
 * here would drag a React Native runtime into the gate.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function read(rel: string): string {
  return readFileSync(rel, 'utf8');
}

const lib = read('src/lib/local-account-data.ts');
const supabaseLib = read('src/lib/supabase.ts');
const deleteLib = read('src/lib/delete-account.ts');
const you = read('src/app/(tabs)/you.tsx');
const insight = read('src/lib/insight/today-insight.ts');
const hook = read('src/hooks/use-daily-insight.ts');
const home = read('src/app/(tabs)/index.tsx');
const devLab = read('src/app/dev-lab.tsx');

// --- deny by default -------------------------------------------------------
// INVARIANT. Erase everything in the namespace except an explicit keep-list.
// The final statement must be a NEGATED prefix test over the keep-prefixes, not
// a positive test over a list of account keys.
assert.match(lib, /export function isAccountScopedKey\(key: string\): boolean \{/);
assert.match(lib, /if \(!key\.startsWith\(ATO_KEY_NAMESPACE\)\) return false;/);
assert.match(lib, /if \(DEVICE_LEVEL_KEYS\.includes\(key\)\) return false;/);
assert.match(lib, /return !DEVICE_LEVEL_PREFIXES\.some\(\(prefix\) => key\.startsWith\(prefix\)\);/);
ok('isAccountScopedKey denies by default — everything in the namespace minus a keep-list');

// INVARIANT. Auth artifacts stay with clearLocalSession, which owns them and
// falls back to SecureStore. Erasing them here would race that fallback.
assert.match(lib, /export const DEVICE_LEVEL_PREFIXES: readonly string\[\] = \['ato\.auth\.'\];/);
ok('ato.auth.* is left to clearLocalSession, not erased here');

// The keep-list is device state only. A key that holds anything derived from
// account content must never appear in it.
for (const keep of [
  'ato.appearance.mode',
  'ato.crisis.region.auto',
  'ato.crisis.region.override',
  'ato.push.prefs.v1',
  'ato.push.asked',
  'ato.ai.provider.override.v1',
]) {
  assert.ok(lib.includes(`'${keep}'`), `keep-list is missing ${keep}`);
}
// INVARIANT, and the behavioural one: re-derive the keep-list from the source
// and run the real predicate's LOGIC over sample keys, rather than trusting the
// literal text. Indentation-insensitive, so reformatting cannot silently pass.
const keepBlock = /export const DEVICE_LEVEL_KEYS: readonly string\[\] = \[([\s\S]*?)\];/.exec(lib);
assert.ok(keepBlock, 'DEVICE_LEVEL_KEYS block not found');
const keepList = [...keepBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const keepPrefixes = [
  ...(/export const DEVICE_LEVEL_PREFIXES: readonly string\[\] = \[([\s\S]*?)\];/
    .exec(lib)?.[1] ?? '')
    .matchAll(/'([^']+)'/g),
].map((m) => m[1]);

function wouldWipe(key: string): boolean {
  if (!key.startsWith('ato.')) return false;
  if (keepList.includes(key)) return false;
  return !keepPrefixes.some((prefix) => key.startsWith(prefix));
}

// The keys that actually leaked must be wiped...
for (const wiped of [
  'ato.today-insight.v1',
  'ato.questions.answeredOption.full-profile:abc.v1',
  'ato.questions.categoryPage.full-profile:abc.v1',
  'ato.profile.fullUnlock.seen.abc.v1',
  'ato.category-teaser.v1:abc:2026-09-15',
  'ato.reveal.opened.v1:abc',
  'ato.questions.prewarm-at.v1',
  'ato.pending_invite_code',
  'ato.dev.growth-preview.v1',
  'ato.dev.slot-override.v1',
  'ato.dev.ask-override.v1',
  // deny-by-default: a key nobody has written yet still goes
  'ato.some.future.account.key.v1',
]) {
  assert.ok(wouldWipe(wiped), `${wiped} holds account content and must be wiped`);
}
// ...device prefs, auth artifacts and foreign namespaces must survive.
for (const kept of [
  'ato.appearance.mode',
  'ato.crisis.region.auto',
  'ato.crisis.region.override',
  'ato.push.prefs.v1',
  'ato.push.asked',
  'ato.ai.provider.override.v1',
  'ato.auth.access_token',
  'ato.auth.refresh_token',
  'sb-something-auth-token',
]) {
  assert.ok(!wouldWipe(kept), `${kept} must survive account deletion`);
}
ok('the keep-list rule, run over real key shapes, wipes account data and spares device prefs');

// --- never throws ----------------------------------------------------------
// INVARIANT. This runs AFTER the server confirms the account is gone. A storage
// failure must not surface as "we could not delete your account".
assert.match(lib, /export async function clearLocalAccountData\(\): Promise<string\[\]> \{/);
assert.match(lib, /\} catch \(err\) \{\s*\n\s*console\.log\('\[local-account-data\] storage clear failed:'/);
ok('clearLocalAccountData swallows storage failures — deletion already succeeded');

// INVARIANT. Delete and re-signup happen in ONE app session with no relaunch,
// so the warm module caches must be cleared alongside storage or they keep
// answering for the previous account.
assert.match(lib, /resetAnsweredOptionCache\(\);/);
assert.match(lib, /resetCategoryPagePositionCache\(\);/);
assert.match(lib, /resetFullProfileUnlockCache\(\);/);
ok('in-memory question/profile caches are reset, not just AsyncStorage');

// INVARIANT. The shipped widget renders from the App Group, which no OTA can
// reach. Leaving it would keep the deleted account's text on a home screen.
assert.match(lib, /function clearWidget\(\): void \{/);
assert.match(lib, /ExtensionStorage\.reloadWidget\(WIDGET_KIND\);/);
ok('the iOS widget App Group is blanked and reloaded');

// INVARIANT, found in review. The OS push schedules are not storage and are not
// the widget. `morningPush(insight.title)` REPEATS DAILY carrying AI-written
// text about the account; PushRuntime unmounts on sign-out, so without this the
// deleted account's content keeps firing until some later account onboards.
assert.match(lib, /cancelAllScheduledPush/);
const push = read('src/lib/push.ts');
assert.match(push, /export async function cancelAllScheduledPush\(\): Promise<void> \{/);
for (const id of ['morning', 'evening', 'insight', 'sunday']) {
  assert.ok(
    push.includes(`cancelScheduledNotificationAsync(PUSH_IDS.${id})`),
    `cancelAllScheduledPush must cancel PUSH_IDS.${id}`,
  );
}
ok('every scheduled push is cancelled — the daily one carried the account insight');

// --- every exit path ------------------------------------------------------
// INVARIANT. Both ways an account leaves this device must clear it. A plain
// sign-out bleeds into the next account exactly the way a deletion did.
assert.match(supabaseLib, /clearLocalAccountData/);
assert.match(you, /import \{ clearLocalAccountData \} from '@\/lib\/local-account-data';/);
assert.match(you, /await clearLocalAccountData\(\);/);
ok('clearLocalSession and the You-tab sign-out both clear local account data');

// delete-account reaches it through clearLocalSession, and must keep calling
// that AFTER the server confirms — signing out first drops the JWT the
// function authenticates with.
assert.match(deleteLib, /await clearLocalSession\(\);/);
assert.match(deleteLib, /if \(!data\?\.deleted\) \{/);
ok('deleteAccount still clears only after the server confirms the deletion');

// --- insight cache ownership ----------------------------------------------
// INVARIANT. The cache key carries no user id and cannot gain one without
// breaking the shipped widget's App Group contract, so the owner rides inside
// the payload and a wrong-owner read returns null.
assert.match(insight, /export async function loadCachedInsight\(expectedUserId\?: string\)/);
assert.match(
  insight,
  /if \(expectedUserId !== undefined && parsed\.userId !== expectedUserId\) return null;/,
);
assert.match(insight, /export function cachedFromInsight\(insight: DailyInsight, userId: string\)/);
ok('loadCachedInsight refuses an insight written by a different account');

assert.match(hook, /export function useDailyInsight\(expectedUserId\?: string\)/);
assert.match(hook, /loadCachedInsight\(expectedUserId\)/);
assert.match(home, /useDailyInsight\(userId\)/);
ok('Home passes its signed-in user id through to the cache read');

// INVARIANT, found in review. The session resolves asynchronously, so Home's
// first renders have no user id. The hook must hold at null rather than read
// unchecked — that restore window is exactly when a wrong-owner paint happens.
assert.match(
  hook,
  /if \(expectedUserId === undefined\) \{[\s\S]*?setInsight\(null\);[\s\S]*?return;/,
);
ok('the hook reads nothing while the signed-in user is still unknown');

// --- the manual-verification hook -----------------------------------------
// The fix runs where nothing is observable, so the Dev Lab panel is the only
// way to see whether a device is actually clean after a delete.
assert.match(devLab, /function LocalAccountData\(\) \{/);
assert.match(devLab, /<LocalAccountData \/>/);
assert.match(devLab, /listAccountScopedKeys/);
ok('Dev Lab exposes the local-account-data panel for manual verification');

console.log(`\n${passed} local-account-data checks passed`);
