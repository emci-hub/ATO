/**
 * Roll/reveal client-side wiring (trait-system redesign §7). Run: npm run check:rolls-store
 *
 * results.ts is pure and imported/tested directly. store.ts/run.ts/generate.ts
 * import @/lib/supabase (pulls in react-native, fails under plain Node — same
 * class of issue paged-questions.tsx once hit) or @/lib/ai/generate,
 * so they're checked via source assertions only, same pattern
 * ai-provider-check.ts already uses for RN-touching files.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  parseClaimRollResult,
  parseRevealRollItemResult,
  parseStoreRollResult,
  rollItemResultIsReady,
} from '../src/lib/rolls/results';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

// --- results.ts (pure) -------------------------------------------------------
assert.deepEqual(parseClaimRollResult(null), { ok: false, reason: 'empty' });
assert.deepEqual(parseClaimRollResult({ ok: true, daily: 1, daily_cap: 1 }), { ok: true, reason: undefined, daily: 1, dailyCap: 1 });
assert.deepEqual(parseClaimRollResult({ ok: false, reason: 'quota' }), { ok: false, reason: 'quota', daily: undefined, dailyCap: undefined });
ok('parseClaimRollResult: reads daily_cap into dailyCap, defensive against empty/malformed input');

assert.deepEqual(parseStoreRollResult(undefined), { ok: false });
assert.deepEqual(
  parseStoreRollResult({ ok: true, already: false, roll_id: 'r1', count: 13 }),
  { ok: true, already: false, rollId: 'r1', count: 13 },
);
ok('parseStoreRollResult: reads roll_id into rollId, defensive against malformed input');

assert.deepEqual(parseRevealRollItemResult({}), { ok: false, already: false, reason: undefined, balance: undefined, price: undefined, revealedAt: undefined, type: undefined });
assert.deepEqual(
  parseRevealRollItemResult({ ok: false, reason: 'not_ready', type: 'category' }),
  { ok: false, already: false, reason: 'not_ready', balance: undefined, price: undefined, revealedAt: undefined, type: 'category' },
);
assert.deepEqual(
  parseRevealRollItemResult({ ok: true, already: false, balance: 7, price: 1, revealed_at: '2026-09-08T00:00:00Z', type: 'category' }),
  { ok: true, already: false, reason: undefined, balance: 7, price: 1, revealedAt: '2026-09-08T00:00:00Z', type: 'category' },
);
ok('parseRevealRollItemResult: reads revealed_at into revealedAt, carries the not_ready reason through');

assert.equal(rollItemResultIsReady(null), false);
assert.equal(rollItemResultIsReady({ ready: false }), false);
assert.equal(rollItemResultIsReady({ ready: true, body: 'x' }), true);
assert.equal(rollItemResultIsReady({ matched: true }), false, 'a result missing the ready key entirely must read as not-ready, matching wave47\'s coalesce-to-false');
ok('rollItemResultIsReady: mirrors wave47\'s server-side ready check client-side, defaults a missing key to false');

// --- store.ts: source assertions (RN-touching, not directly importable) ---
const storeSrc = read('src/lib/rolls/store.ts');
assert.match(storeSrc, /supabase\.rpc\('claim_roll'\)/);
assert.match(storeSrc, /supabase\.rpc\('store_roll', \{/);
assert.match(storeSrc, /p_roll_id: rollId/);
assert.match(storeSrc, /p_axis_snapshot: snapshot/);
assert.match(storeSrc, /supabase\.rpc\('reveal_roll_item', \{ p_item_id: itemId \}\)/);
assert.match(storeSrc, /supabase\.rpc\('claim_roll_generation'\)/, 'store.ts must also wrap claim_roll_generation (wave48), not just the original three RPCs');
assert.match(storeSrc, /from\('trait_roll_snapshots'\)/);
assert.match(storeSrc, /order\('created_at', \{ ascending: false \}\)/);
assert.match(storeSrc, /import \{[\s\S]*?\} from '\.\/results'/, 'store.ts must delegate parsing to the pure results.ts module, not duplicate it');
ok('store.ts calls all four RPCs (including claim_roll_generation) with the correct argument names, fetches the latest snapshot ordered newest-first, delegates parsing to results.ts');

assert.match(storeSrc, /export async function fetchRollItems\(rollId: string\)/, 'store.ts must expose a reader for a stored roll\'s items — runRoll only returns the roll_id, nothing previously fetched the 13 rows back for display');
assert.match(storeSrc, /from\('trait_rolls'\)/);
assert.match(storeSrc, /\.eq\('roll_id', rollId\)/);
ok('store.ts exposes fetchRollItems, reading trait_rolls scoped by roll_id (RLS scopes it to the caller\'s own rows)');

assert.match(storeSrc, /export async function fetchLatestRollId\(userId: string\)/, 'store.ts must expose a way to find the user\'s most recent roll_id — a screen restoring after reload/navigation has no other way to find what to fetchRollItems for');
assert.match(storeSrc, /\.eq\('user_id', userId\)[\s\S]*?\.order\('created_at', \{ ascending: false \}\)[\s\S]*?\.limit\(1\)/, 'fetchLatestRollId must scope to the given user and order newest-first');
ok('store.ts exposes fetchLatestRollId, ordered newest-first and scoped to the caller\'s own rows');

assert.match(storeSrc, /export async function fetchRevealedRollItems\(\s*\n\s*userId: string,\s*\n\s*types: readonly RollItem\['type'\]\[\],\s*\n\)/, 'store.ts must expose a history reader (§8) across ALL rolls, not just one roll_id');
assert.match(storeSrc, /\.eq\('user_id', userId\)[\s\S]*?\.in\('type', types\)[\s\S]*?\.not\('revealed_at', 'is', null\)[\s\S]*?\.order\('revealed_at', \{ ascending: false \}\)[\s\S]*?\.limit\(REVEALED_HISTORY_LIMIT\)/, 'fetchRevealedRollItems must scope to the user, filter by type and revealed-only, newest reveal first, and cap the query');
ok('store.ts exposes fetchRevealedRollItems (§8 history/archive), scoped, type-filtered, revealed-only, newest-first, capped');

// --- compose.ts: display-only price mirror ---------------------------------
const composeSrc = read('src/lib/rolls/compose.ts');
assert.match(composeSrc, /export function rollItemPrice\(type: RollItemType\): number \{\s*\n\s*return type === 'legend' \? 5 : 1;/, 'rollItemPrice must mirror reveal_roll_item\'s own server-side pricing exactly (wave46/47 SQL: legend=5, else=1)');
ok('compose.ts exposes rollItemPrice as a display-only mirror of the server\'s authoritative pricing');

// --- run.ts / generate.ts: dead (no callers), deleted 2026-10-20 ---------------
// No client code may run a roll or make a roll model call. Pass: the files are
// gone, ROLL_META is gone, and the rolls store makes no model call.
for (const gone of ['src/lib/rolls/run.ts', 'src/lib/rolls/generate.ts']) {
  assert.ok(!existsSync(resolve(root, gone)), gone + ' must stay deleted');
}
assert.doesNotMatch(read('src/lib/ai/call-sites.ts'), /ROLL_META/, 'ROLL_META is gone with its only call site');
assert.doesNotMatch(storeSrc, /import[^;]*@\/lib\/ai\/|generateText\(/,'store.ts makes no model call');
ok('rolls run.ts and generate.ts stay deleted; no ROLL_META, no model call in the rolls store');

console.log(`\n${passed} rolls-store checks passed`);
