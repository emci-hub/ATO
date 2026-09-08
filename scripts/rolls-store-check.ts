/**
 * Roll/reveal client-side wiring (trait-system redesign §7). Run: npm run check:rolls-store
 *
 * results.ts is pure and imported/tested directly. store.ts/run.ts/generate.ts
 * import @/lib/supabase (pulls in react-native, fails under plain Node — same
 * class of issue category-paged-questions.tsx once hit) or @/lib/ai/generate,
 * so they're checked via source assertions only, same pattern
 * ai-provider-check.ts already uses for RN-touching files.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// --- compose.ts: display-only price mirror ---------------------------------
const composeSrc = read('src/lib/rolls/compose.ts');
assert.match(composeSrc, /export function rollItemPrice\(type: RollItemType\): number \{\s*\n\s*return type === 'legend' \? 5 : 1;/, 'rollItemPrice must mirror reveal_roll_item\'s own server-side pricing exactly (wave46/47 SQL: legend=5, else=1)');
ok('compose.ts exposes rollItemPrice as a display-only mirror of the server\'s authoritative pricing');

// --- generate.ts: dedicated call site with the right metadata, gated by its own quota ---
const generateSrc = read('src/lib/rolls/generate.ts');
assert.match(generateSrc, /import \{ ROLL_META \} from '@\/lib\/ai\/call-sites'/);
assert.match(generateSrc, /generateText\(\{[\s\S]*?\}, ROLL_META\)/, 'must pass ROLL_META on the same line as the closing brace — matching the exact shape check:ai\'s regex requires (a prior attempt split this across lines with a trailing comma and failed the check)');
const claimGenIdx = generateSrc.indexOf('claimRollGeneration()');
const generateTextIdx = generateSrc.indexOf('generateText({');
assert.ok(claimGenIdx > -1 && generateTextIdx > claimGenIdx, 'claimRollGeneration must be called BEFORE generateText — found in review: every generateText call goes through ai-generate\'s shared Sage/Explore quota regardless of feature, so rolls need their OWN bound claimed first, same pattern claim_questions_batch already uses for Infinite Questions');
assert.match(generateSrc, /if \(!claim\.ok\) return null;/, 'a refused claim_roll_generation must degrade to null (treated as "not ready" for that item), never throw and fail the whole roll');
// Found in review: claimRollGeneration (store.ts) throws on any RPC error
// (network blip, or the RPC not yet applied) — generateRollItemText must
// catch that itself, not just handle a clean {ok:false} refusal, or a
// single transient failure would abort composeRoll's whole item loop.
assert.match(generateSrc, /try \{[\s\S]*claimRollGeneration\(\)[\s\S]*\} catch \(err\) \{[\s\S]*return null;\s*\n\s*\}/, 'generateRollItemText must wrap the claim + generation in try/catch and return null on any error, matching its documented "never throws" contract');
ok('generate.ts is a dedicated ROLL_META call site, formatted the way check:ai\'s static scan requires, gated by its own per-generation quota claimed first, and never throws');

// --- run.ts: eligibility checked before quota is ever claimed -------------
const runSrc = read('src/lib/rolls/run.ts');
const eligibleIdx = runSrc.indexOf('if (!rollEligible(tracks, lastSnapshot))');
const claimIdx = runSrc.indexOf('await claimRoll();'); // the real call — "claimRoll()" alone also matches the docstring's prose mention of it
assert.ok(eligibleIdx > -1 && claimIdx > eligibleIdx, 'rollEligible must be checked BEFORE claimRoll in control flow — reduces unnecessary claims for an honest client');
assert.match(runSrc, /if \(!rollEligible\(tracks, lastSnapshot\)\) \{\s*\n\s*return \{ kind: 'not_eligible' \};/);
assert.match(runSrc, /Crypto\.randomUUID\(\)/, 'roll_id generation must use expo-crypto\'s randomUUID (the global crypto object is not reliably available in React Native), same pattern auth-apple.ts already uses');
// Found in review: an earlier version let any unexpected throw (a network
// blip, storeRoll rejecting a payload, etc.) propagate uncaught from
// runRoll — a real problem since claimRoll may have already spent the
// day's 1/day composition attempt by the time a later step fails.
assert.match(runSrc, /try \{[\s\S]*fetchLastRollSnapshot[\s\S]*\} catch \(err\) \{[\s\S]*return \{ kind: 'error', message \};?\s*\n\s*\}/, 'runRoll must wrap its entire body in try/catch and return {kind:\'error\'} on any unexpected throw, not propagate it uncaught');
// The docstring must NOT claim server-side enforcement it doesn't have —
// found in review: an earlier version claimed §7's "gated server-side...
// never trusted from the client" requirement was satisfied, when
// rollEligible actually runs in this same client file.
assert.match(runSrc, /NOT server-enforced/, 'run.ts must honestly document that eligibility is client-checked only, not silently claim server-side enforcement it doesn\'t have');
assert.doesNotMatch(runSrc, /rolling itself[\s\S]{0,40}must be gated server-side, not just revealing\.\s*\*\//, 'the old false claim of satisfying §7\'s server-gating requirement must be gone');
ok('run.ts checks RCI eligibility before claiming roll-composition quota, generates roll_id via expo-crypto, and its docstring honestly documents the client-side-only eligibility gap instead of claiming server enforcement it doesn\'t have');

console.log(`\n${passed} rolls-store checks passed`);
